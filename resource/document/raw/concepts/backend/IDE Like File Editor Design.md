
For this kind of IDE/file-editor backend, I would make the **filesystem the source of truth** and use the Go service as a **coordination layer**, not as the primary file database.

The main problem to solve is this:

```text
IDE edits file
        ↘
          same file
        ↗
Notepad / VS Code / OS tool edits file
```

Both sides must stay synchronized without one silently overwriting the other.

My preferred architecture is:

```text
                    ┌────────────────────┐
                    │       IDE UI       │
                    │ React / Qt / etc   │
                    └─────────┬──────────┘
                              │
                     WebSocket / RPC
                              │
                              ▼
┌──────────────────────────────────────────────────┐
│                Go Editor Service                 │
│                                                  │
│  ┌───────────────┐     ┌────────────────────┐   │
│  │ File Manager  │────▶│ Per-file Actor     │   │
│  │               │     │ / Coordinator      │   │
│  └───────┬───────┘     └──────────┬─────────┘   │
│          │                          │             │
│          │                version / hash / state │
│          │                          │             │
│  ┌───────▼────────┐       ┌────────▼─────────┐  │
│  │ File Watcher   │       │ Change Journal   │  │
│  │ fsnotify       │       │ optional bbolt   │  │
│  └───────┬────────┘       └──────────────────┘  │
│          │                                       │
└──────────┼───────────────────────────────────────┘
           │
           ▼
      File System
           ▲
           │
   Notepad / VS Code
   Git / CLI / tools
```

The important idea is:

> **Every modification, regardless of where it originates, becomes a versioned file event.**

---

# 1. Don't store the actual project files in bbolt

I would **not** do this:

```text
bbolt
├── main.go -> full contents
├── app.tsx -> full contents
├── README.md -> full contents
└── ...
```

Your actual files should remain:

```text
workspace/
├── main.go
├── go.mod
├── internal/
│   └── service.go
└── README.md
```

The filesystem remains canonical.

Use bbolt only for things such as:

```text
bbolt
├── workspace metadata
├── file versions
├── hashes
├── pending write journal
├── recovery metadata
├── open file state
└── optional undo/checkpoint metadata
```

Example:

```text
files bucket

/internal/service.go
    version: 38
    hash: d983...
    modified: 1788841234
```

This keeps your system simple and memory-efficient.

---

# 2. Give every file a monotonically increasing version

Suppose:

```text
main.go

version = 10
```

IDE opens it.

The IDE receives:

```json
{
  "path": "main.go",
  "version": 10,
  "content": "package main..."
}
```

Then the IDE modifies it.

Instead of simply saying:

```json
{
  "content": "..."
}
```

send:

```json
{
  "path": "main.go",
  "baseVersion": 10,
  "changes": [...]
}
```

The Go service now knows:

> This edit was created from version 10.

If the current server version is also `10`:

```text
client baseVersion = 10
server version     = 10

OK
```

Apply it and create:

```text
version 11
```

---

# 3. External edits use exactly the same version system

Imagine the IDE currently knows:

```text
main.go
version 11
```

Then the user opens:

```text
Notepad
```

and modifies the file.

`fsnotify` detects:

```text
WRITE main.go
```

Your service then:

1. reads the file
    
2. hashes it
    
3. compares it to the known hash
    
4. sees that it actually changed
    
5. creates version `12`
    
6. broadcasts it to IDE clients
    

Flow:

```text
Notepad
   │
   │ save
   ▼
filesystem
   │
   ▼
fsnotify
   │
   ▼
File Coordinator
   │
   ├── calculate hash
   ├── update version 11 → 12
   └── broadcast
             │
             ▼
            IDE
```

WebSocket event:

```json
{
  "type": "file.changed",
  "path": "main.go",
  "version": 12,
  "source": "filesystem"
}
```

The IDE reloads or requests the diff.

---

# 4. Avoid the watcher feedback loop

This is a subtle but important problem.

Your IDE says:

```text
save main.go
```

Go writes:

```text
main.go
```

Then `fsnotify` says:

```text
main.go changed!
```

Your service might mistakenly interpret its own save as an external modification.

Do **not** simply ignore filesystem events for 500 ms. That's fragile.

Instead keep the expected content hash.

Example:

```text
IDE save
    ↓
new hash = abc123
    ↓
write file
    ↓
remember expected hash = abc123
    ↓
fsnotify WRITE
    ↓
hash file = abc123
    ↓
same as expected
    ↓
this is our own write
```

If instead:

```text
expected = abc123

disk = xyz789
```

then something else modified it.

That becomes a legitimate external event.

---

# 5. Always use atomic writes

Never write directly like:

```go
os.WriteFile(path, data, 0644)
```

for your important editor save path if another process may simultaneously observe it.

Use:

```text
main.go
   ↓
.main.go.tmp-83912
   ↓
fsync
   ↓
rename
   ↓
main.go
```

Conceptually:

```go
func atomicWrite(path string, data []byte) error {
    dir := filepath.Dir(path)

    tmp, err := os.CreateTemp(dir, ".editor-*")
    if err != nil {
        return err
    }

    tmpName := tmp.Name()

    defer func() {
        tmp.Close()
        os.Remove(tmpName)
    }()

    if _, err := tmp.Write(data); err != nil {
        return err
    }

    if err := tmp.Sync(); err != nil {
        return err
    }

    if err := tmp.Close(); err != nil {
        return err
    }

    return os.Rename(tmpName, path)
}
```

So another process sees either:

```text
OLD COMPLETE FILE
```

or:

```text
NEW COMPLETE FILE
```

rather than:

```text
half-written file
```

---

# 6. But native editors may also use atomic rename

Notepad, VS Code, JetBrains, Vim, etc. don't necessarily do:

```text
WRITE file
```

Some do:

```text
create tmp
write tmp
delete original
rename tmp -> original
```

So your watcher has to handle:

```text
WRITE
CREATE
REMOVE
RENAME
CHMOD
```

You cannot assume one save equals one `WRITE` event.

I would implement a small debounce/settling layer:

```text
fsnotify events

WRITE
WRITE
CHMOD
RENAME
CREATE
    │
    ▼
coalesce by path
    │
   20-100ms
    │
    ▼
read final filesystem state
```

Don't process every low-level OS notification independently.

---

# 7. Per-file actor is the architecture I'd use

This is particularly nice in Go.

Instead of:

```text
global mutex
```

or hundreds of locks everywhere, give every currently active file a tiny coordinator.

Example:

```go
type FileActor struct {
    Path string

    events chan Event

    version uint64
    hash    [32]byte
}
```

All operations affecting that file are sent through:

```text
actor.events
```

For example:

```text
IDE patch
filesystem changed
save
rename
delete
reload
```

Only one goroutine processes them:

```go
func (f *FileActor) run() {
    for event := range f.events {
        switch event.Type {

        case EventIDEEdit:
            f.handleIDEEdit(event)

        case EventFilesystemChange:
            f.handleFilesystemChange(event)

        case EventSave:
            f.handleSave(event)
        }
    }
}
```

Now:

```text
IDE write ──────┐
                │
Notepad write ──┼──▶ FileActor ───▶ serialized state
                │
Git checkout ───┘
```

This eliminates a huge number of race conditions.

---

# 8. Don't create actors for every file

For a repository with:

```text
100,000 files
```

don't spawn:

```text
100,000 goroutines
```

Only activate actors for files that are:

```text
opened
being edited
recently modified
being watched intensively
```

You could have:

```text
Workspace
    │
    ├── 100,000 files
    │
    └── active actors
          ├── main.go
          ├── app.tsx
          └── config.yaml
```

Maybe three goroutines.

After inactivity:

```text
5-10 minutes
    ↓
persist metadata
    ↓
terminate actor
```

That gives you a very small runtime footprint.

---

# 9. What happens when both sides edit simultaneously?

This is the real hard part.

Suppose:

```text
disk version 20
```

IDE starts editing version 20.

But doesn't save yet.

Then Notepad changes the file:

```text
20
 ↓
21
```

IDE eventually tries:

```json
{
  "baseVersion": 20,
  "changes": [...]
}
```

But server now has:

```text
currentVersion = 21
```

Never blindly save it.

Otherwise you lose the Notepad changes.

Instead:

```text
baseVersion = 20
current     = 21

       CONFLICT / REBASE REQUIRED
```

---

# 10. Use a three-way merge

Keep:

```text
BASE
version 20

OURS
IDE modifications

THEIRS
filesystem version 21
```

Then:

```text
           version 20
             BASE
            /    \
           /      \
       IDE         OS
       OURS       THEIRS
           \      /
            MERGE
```

For example:

Base:

```go
func hello() {
    fmt.Println("hello")
}
```

IDE changes:

```go
func hello() {
    fmt.Println("hello world")
}
```

Notepad independently changes:

```go
func hello() {
    fmt.Println("hello")
}

func goodbye() {}
```

These can usually merge cleanly:

```go
func hello() {
    fmt.Println("hello world")
}

func goodbye() {}
```

But if both edit:

```go
fmt.Println("hello")
```

differently, mark it as a conflict.

The IDE should then show:

```text
File changed externally.

[Compare]
[Reload]
[Keep Mine]
```

Never silently overwrite.

---

# 11. Separate `Document` from `File`

I strongly recommend having these as separate concepts.

### File

What's on disk:

```go
type FileState struct {
    Path    string
    Version uint64
    Hash    [32]byte
    ModTime int64
}
```

### Document

What's currently being edited:

```go
type Document struct {
    FilePath string

    BaseVersion uint64

    Dirty bool

    Buffer Buffer
}
```

This distinction matters because:

```text
File
    = persisted disk state

Document
    = user's unsaved editing state
```

For example:

```text
disk:

main.go v10
```

while IDE has:

```text
document:

baseVersion = 10
dirty       = true
```

That's perfectly valid.

---

# 12. Don't send entire files for every keystroke

Bad:

```text
user types "a"

IDE
 ↓
send entire 2 MB file
 ↓
Go service
```

Do operations.

For example:

```json
{
  "type": "edit",
  "path": "main.go",
  "baseVersion": 10,
  "operations": [
    {
      "start": 283,
      "delete": 0,
      "insert": "a"
    }
  ]
}
```

Or:

```text
replace bytes [283:283]
with "a"
```

Much lower traffic and less allocation.

---

# 13. But don't write every keystroke to disk either

Use two states:

```text
Editor Buffer
     │
     │ patches
     ▼
Go Document
     │
     │ debounce / explicit save
     ▼
Filesystem
```

For example:

```text
keystrokes
   ↓
in-memory document
   ↓
500 ms idle
or Ctrl+S
   ↓
atomic disk save
```

Depending on the UX you want.

You could also behave like VS Code:

```text
autoSave = false
```

until user saves.

---

# 14. Buffer structure

For normal source files, don't overengineer initially.

You have several options.

### Small files

Just use:

```go
[]byte
```

For example:

```text
1 KB
10 KB
100 KB
1 MB
```

Perfectly fine.

### Large actively edited files

Eventually consider:

```text
Piece Table
```

or:

```text
Rope
```

I personally would choose a **piece table** for an IDE.

Conceptually:

```text
Original Buffer
"hello world"

Add Buffer
"awesome "

Pieces:
[
  original[0:6],
  add[0:8],
  original[6:11]
]
```

Result:

```text
hello awesome world
```

You don't repeatedly copy the entire file on every insertion.

That becomes valuable for:

```text
10MB log files
large JSON
generated code
large text files
```

But start with `[]byte` unless profiling shows a problem.

---

# 15. Suggested Go modules

I'd build something like:

```text
internal/
├── workspace/
│   ├── manager.go
│   └── paths.go
│
├── filewatch/
│   ├── watcher.go
│   └── debounce.go
│
├── document/
│   ├── manager.go
│   ├── actor.go
│   ├── buffer.go
│   └── version.go
│
├── filesystem/
│   ├── atomic_write.go
│   ├── hash.go
│   └── stat.go
│
├── sync/
│   ├── protocol.go
│   ├── merge.go
│   └── conflict.go
│
├── transport/
│   ├── websocket.go
│   └── rpc.go
│
└── persistence/
    └── bbolt.go
```

Top level:

```text
cmd/
└── editor-daemon/
    └── main.go
```

---

# 16. Example protocol

IDE opens file:

```json
{
  "type": "file.open",
  "path": "internal/auth/service.go"
}
```

Server:

```json
{
  "type": "file.opened",
  "path": "internal/auth/service.go",
  "version": 38,
  "content": "package auth..."
}
```

Edit:

```json
{
  "type": "file.edit",
  "path": "internal/auth/service.go",
  "baseVersion": 38,
  "operations": [
    {
      "offset": 325,
      "delete": 4,
      "insert": "User"
    }
  ]
}
```

Acknowledgment:

```json
{
  "type": "file.edit.ack",
  "path": "internal/auth/service.go",
  "version": 39
}
```

External change:

```json
{
  "type": "file.external_change",
  "path": "internal/auth/service.go",
  "version": 40
}
```

Conflict:

```json
{
  "type": "file.conflict",
  "path": "internal/auth/service.go",

  "baseVersion": 38,
  "currentVersion": 40
}
```

---

# 17. Where bbolt fits

I'd have maybe four buckets.

```text
editor.db

workspace
files
journal
sessions
```

### `files`

```text
/path/to/main.go

{
    version: 120,
    hash: ...
}
```

### `journal`

Only for operations that need crash recovery.

For example:

```text
write started
    ↓
journal operation
    ↓
atomic file write
    ↓
mark operation complete
```

On crash:

```text
restart
  ↓
read unfinished journal
  ↓
verify disk state
  ↓
recover
```

### `workspace`

```text
workspace ID
root path
settings
```

### `sessions`

Maybe:

```text
last opened files
cursor position
tabs
```

Though UI-specific state can also live elsewhere.

---

# 18. One writer for bbolt

bbolt supports many readers but only one write transaction at a time.

That's actually fine for this use case.

Don't have every actor independently hammer the DB.

Have:

```text
FileActor ─────┐
FileActor ─────┤
Workspace ─────┼──▶ persistence channel
FileWatcher ───┘
                      │
                      ▼
                DB writer goroutine
                      │
                      ▼
                    bbolt
```

Example:

```go
type Persistence struct {
    writes chan DBOperation
}
```

One goroutine:

```go
func (p *Persistence) run() {
    for op := range p.writes {
        p.db.Update(func(tx *bolt.Tx) error {
            return op(tx)
        })
    }
}
```

Benefits:

```text
fewer transactions
less contention
easy batching
predictable memory
```

---

# 19. Memory strategy

If low memory is a priority, I'd follow these rules.

```text
DON'T

cache every project file
index every file into RAM
spawn goroutine per workspace file
keep full revision history in memory
send full file for each edit
```

Instead:

```text
DO

lazy-load files
actor only for open files
evict inactive documents
use hashes for inactive files
stream large reads
store metadata in bbolt
batch watcher events
use patches
```

Imagine a project containing:

```text
80,000 files
3 GB
```

but the user currently has:

```text
main.go
server.go
App.tsx
```

open.

Your memory should mostly represent:

```text
3 documents
watcher
workspace index metadata
connections
```

not the 3 GB repository.

---

# 20. Directory watching

Another important memory/performance issue.

On Linux, recursively watching huge trees can consume a lot of watcher handles.

Instead, your watcher abstraction should support platform-specific behavior.

Conceptually:

```go
type Watcher interface {
    Watch(root string) error
    Events() <-chan FileEvent
}
```

Then implementation:

```text
Windows
    ReadDirectoryChangesW

Linux
    inotify

macOS
    FSEvents / kqueue
```

`fsnotify` gives you a convenient cross-platform abstraction initially.

For a first version:

```text
github.com/fsnotify/fsnotify
```

is the obvious choice.

---

# 21. Ignore directories aggressively

Don't watch:

```text
.git/
node_modules/
dist/
build/
target/
.idea/
.vscode/
vendor/
tmp/
```

unless required.

Your watcher might have:

```go
var ignored = []string{
    ".git",
    "node_modules",
    "dist",
    "build",
    "target",
}
```

And read `.gitignore`.

This makes a tremendous difference for an IDE.

---

# 22. Treat rename as first-class

Don't model only:

```text
file changed
```

Your events should be:

```go
type EventType uint8

const (
    EventCreated EventType = iota
    EventModified
    EventDeleted
    EventRenamed
)
```

Because IDE operations include:

```text
rename file
move file
delete file
create folder
rename folder
```

You eventually want:

```json
{
  "type": "file.renamed",
  "oldPath": "foo.go",
  "newPath": "bar.go"
}
```

---

# 23. I'd also give files stable IDs

Paths change.

Consider:

```text
src/foo.go
```

renamed to:

```text
src/service.go
```

If identity is just the path, your system sees:

```text
delete foo.go
create service.go
```

Instead:

```go
type FileID uint64
```

Internal representation:

```text
File ID: 19283

old path:
src/foo.go

new path:
src/service.go
```

This makes things like:

```text
open editor tab
undo
cursor state
LSP state
git state
```

much easier.

You can persist the mapping in bbolt.

---

# The architecture I'd choose

The final design would be approximately:

```text
                        ┌──────────────────┐
                        │      IDE UI      │
                        └────────┬─────────┘
                                 │
                              WebSocket
                                 │
                                 ▼
                    ┌──────────────────────┐
                    │    Editor Service    │
                    │                      │
                    │  Session Manager     │
                    │         │            │
                    │         ▼            │
                    │ Document Manager     │
                    │         │            │
                    │         ▼            │
                    │ Per File Actor       │
                    │         │            │
                    └─────────┼────────────┘
                              │
                  ┌───────────┴───────────┐
                  │                       │
                  ▼                       ▼
           Atomic File I/O            bbolt
                  │                 metadata only
                  │
                  ▼
              Filesystem
                  ▲
                  │
            fsnotify watcher
                  │
                  └────── back to
                         File Actor
```

The invariant I'd enforce is:

```text
                  ┌─────────────┐
IDE operation ───▶│             │
                  │ File Actor  │──▶ filesystem
OS operation ────▶│             │
                  └─────────────┘

Only FileActor changes version state.
```

That single rule prevents a lot of architectural mess.

## Technology choices

For your constraints, I would use:

|Concern|Choice|
|---|---|
|Language|Go|
|Filesystem watcher|`fsnotify`|
|Metadata persistence|`bbolt`|
|File contents|Real filesystem|
|Transport|WebSocket initially|
|Internal concurrency|actor/channel per active file|
|File identification|stable `FileID` + path|
|Change detection|SHA-256/BLAKE3 hash|
|Saving|temp file + fsync + atomic rename|
|IDE edits|offset/patch operations|
|External edits|filesystem watcher|
|Conflict handling|version check + three-way merge|
|Buffer V1|`[]byte`|
|Buffer later|piece table|
|State recovery|small bbolt journal|
|Large files|lazy/streamed|

And I would **not introduce SQLite/Postgres/Redis** here. For a local IDE daemon, bbolt's simplicity fits the problem well.

The most important architectural decision is actually not bbolt: it's making **`FileActor` the serialization point and using `baseVersion` on every edit**. Once those two things exist, IDE edits, Notepad edits, Git checkout, formatters, code generators, and future AI editing can all go through the same consistency model.