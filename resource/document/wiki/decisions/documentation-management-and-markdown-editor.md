# Documentation Management and Markdown Editor

**Summary**: Pure filesystem-backed `.md` and `.html` documentation tree discovery, file-only drag-and-drop relocation, and live Markdown editor with 500ms debounced UTF-16 slice synchronization over Socket.IO.
**Sources**: `resource/document/raw/tasks/Initiate Mechanism for Document Management.md`, `resource/document/raw/tasks/Initiate Page type Document.md`, `resource/document/raw/tasks/Fixing Behavior of DocumentEditor.md`, `resource/document/raw/decisions/Markdown Basic Syntax.md`, `resource/document/raw/decisions/Markdown advance syntax.md`
**Last updated**: 2026-10-25

---

## Context

Projects in API Tester contain Markdown (`.md`) and HTML (`.html`) documentation files alongside API collections and source code. Users need a dedicated **Documentations** section in the sidebar to browse, create, rename, move, and delete documentation files, open `.html` files in their OS default browser, and edit `.md` files directly inside an interactive editor tab with live Markdown rendering and a fixed header formatting toolbar.

## Key Decisions

### 1. Pure Filesystem Discovery and Relative Path Identifiers
Instead of maintaining a separate BoltDB bucket that could drift out of sync with external git operations or IDE edits, the backend `documentation` service (`internal/service/documentation`, `package doc`) resolves the documentation tree directly from the active `Project.Path`:
- Recursively scans the project directory while skipping noise directories (`.git`, `node_modules`, `dist`, `build`, `vendor`, `.idea`, `.vscode`, `.next`, `coverage`) and non-relevant folders that do not contain `.md` or `.html` files.
- Uses normalized forward-slash paths relative to `Project.Path` (e.g., `docs/guide.md`) as deterministic node `id` values, validated against path traversal via `resolveSafePath`.
- Categorizes nodes as `FOLD` (folders), `DOC_MD` (`.md` files), or `DOC_HTML` (`.html` files).
- Switching active collections via `CollectionManage` invalidates `documentTreeQueryKey` (`["documentation", "tree"]`), instantly reloading the documentation tree for the newly selected collection.

### 2. File-Only Drag-and-Drop (`MoveDocument`)
To prevent accidental relocation of source-code folders inside a user's repository, drag-and-drop in `DocumentationSidebar` and `PUT /documentation/move` only permits moving `DOC_MD` and `DOC_HTML` files into target folders (`FOLD`) or the project root. Folder nodes (`FOLD`) are drop targets only and cannot be dragged.

### 3. External Browser Launch for `.html` Files
Clicking a `.html` node (`DOC_HTML`) in `DocumentationSidebar` invokes `window.electronAPI.openExternal(node.path)` (backed by Electron's `shell.openPath` / `shell.openExternal` IPC handler `shell:open-external`) so static HTML reports and docs open in the user's default system browser without creating an editor tab.

### 4. Live Markdown Editor and Typing Behaviors
Opening a `.md` file opens a `DOC` (`type: 'document'`) tab rendered by `DocumentEditor.tsx` paired with `DocumentEditorHeader.tsx` in the fixed top header:
- **Strict Formatting & Toggling**: `**bold**` / `__bold__` maps to `<strong>`, while `*italic*` / `_italic_` maps to `<em>`. Applying bold to already bold text unbolds to normal text, and applying italic to already italic text unitalicizes without style conflicts.
- **Dynamic Syntax Reveal**: Formatted nodes (`strong`, `em`, `code`, `del`, `h1`..`h6`) render with `.md-syntax` markers. When the cursor focuses on a formatted node, `.syntax-active` reveals the raw markdown delimiters (`**`, `*`, `~`, `` ` ``, `#`), and collapses them back to rendered styling when navigating away. Editing `#` markers inside `h1`..`h6` updates the heading level live or unwraps the heading back into a `<p>` paragraph when all `#` markers are deleted, while stripping browser-injected `<font>`/`<span style>` nodes and resetting the selection range so Chromium's `TypingStyle` never leaks monospace or `oklab` (`rgb(0, 85, 0)` green) styles onto new lines.
- **Tab Key Handling**: Prevents focus blur. Indents normal lines by 2 spaces (Shift+Tab outdents). On list items (`<li>`), Tab nests the item under the previous sibling item, and Shift+Tab outdents to parent list or paragraph.
- **Bracket & Quote Auto-wrapping**: Typing any opening bracket or quote (`` ` ``, `[`, `{`, `(`, `'`, `"`, `<`) around selected text wraps the selection instead of replacing it.
- **Escape Syntax with `\`**: Prefixing block or inline formatting symbols with a backslash `\` disables styling transformations.
- **Code Block Snippet**: Typing ```` ```<lang> ```` followed by Enter generates an embedded code block container featuring an editable language definition input (`data-lang-input`), dedicated multiline code editing, Tab indenting, and Shift+Enter breakout.
- **Interactive Table Grid Picker & Hover Row/Column Controls**: Clicking the Table button in `DocumentEditorHeader.tsx` opens a Google Docs-style dynamic grid picker (starting at 11×5 and expanding up to 20×20 as the cursor hovers near the edges) to insert a table with custom `cols × rows`. In Live Mode, hovering a table cell in `DocumentEditor.tsx` renders floating row and column action pills outside the `contentEditable` DOM (`Insert 1 row below` / `Delete row` on the left of the hovered row and `Insert 1 column to the right` / `Delete column` on top of the hovered column) that mutate the table in place and sync back to Markdown.
- **Interactive Image Placeholder, Replacement & Manual Drag Resize**: Clicking the Insert Image toolbar button (`{type: "image"}`) inserts an interactive placeholder block (`![image]()`) with **Use URL** and **Select File** buttons. Entering a valid image URL (verified via `new Image()` `onload`) or choosing a local file immediately renders the `<img>`. Hovering any rendered `<img>` in Live Mode overlays a replacement bar (**Use URL** / **Select File**) plus corner and edge resize handles that update image dimensions live and persist as `![alt|WxH](src)` in Markdown.

### 5. Bold / Italic Toggling Without Re-render (`inlineFormat.ts`)
Ctrl+B, Ctrl+I and the header Bold/Italic buttons call `toggleInlineFormat` in `frontend/src/pages/editor/utils/inlineFormat.ts` (live mode) or `toggleMarkdownFormat` (source mode). Rules:
- Only `*` / `**` delimiters are generated; manually typed `_` / `__` still parse as bold/italic. Bold plus italic is `***text***` (nested `strong` > `em`).
- Leading/trailing whitespace of the selection stays **outside** the delimiters (`**word** `, never `**word **`), because CommonMark emphasis with inner edge whitespace is not emphasis and rendered as a stray italic. `htmlToMarkdown` (`wrapDelimited`) enforces the same rule for typed content.
- The live DOM is edited in place (text nodes are split and wrapped, never re-rendered), so the selection and caret survive and the cursor no longer jumps to the document start. Applying the format to text that is already fully bold/italic removes it (splitting the wrapper so only the selection loses it); mixed selections become fully formatted and adjacent wrappers merge.
- `parseInline` in `markdown.ts` shares one placeholder store between nested calls and stashes generated `strong`/`em`/`del`/`mark` HTML. Before, `**x**` re-parsed its own `md-syntax` stars as italic, which swallowed text up to the next `*`.
- `useLiveTransform` ignores text typed inside `.md-syntax` markers, so typing a space after a revealed `*` can no longer turn the block into an empty list. All formatted ancestors get `.syntax-active`, so `***` shows when the cursor is in bold italic text.

### 6. 500ms Debounced UTF-16 Slice Socket Sync and File Watcher Suppression
When editing a Markdown document:
- Frontend computes the changed UTF-16 slice (`{ id, content, startPos, lenght }`) via `computeDocumentDiff(prev, next)` and emits `document:content:edit` to the `/documentation` Socket.IO namespace after a 500ms debounce.
- Backend `EditDocumentContentRequest.ApplyTo` splices the replacement into the file's UTF-16 code-unit representation and writes atomically while calling `docWatcher.SuppressPath(absPath, 600*time.Millisecond)`.
- The frontend does not re-fetch on its own `document:content:edit` emissions; it only re-fetches when an external file modification triggers `document:refresh` with payload `true`.

## Related pages

- [[decisions/project-folder-discovery-and-collection-hierarchy]]
- [[patterns/frontend/create-new-tabs-kind]]
- [[patterns/frontend/socket-io-service-and-hook-wiring]]
- [[patterns/usecase/usecase-rules-of-engagement]]
