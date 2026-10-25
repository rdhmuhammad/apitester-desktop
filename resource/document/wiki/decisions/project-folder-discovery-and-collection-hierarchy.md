# Project Folder Discovery and Collection Hierarchy

**Summary**: Refactors collection management from individual file parsing into a project-based folder discovery workflow where adding a folder creates a Project, recursively discovers valid Postman collection JSON files, links them as children in a parent-child hierarchy, synchronizes selection, and enables inline collection creation directly into chosen directory paths.
**Sources**: `internal/domain/collection.go`, `internal/service/project/usecase.go`, `internal/service/collection/usecase.go`, `internal/adapter/controller/project/controller.go`, `frontend/src/layout/components/collectionManager/CollectionManage.tsx`
**Last updated**: 2026-10-19

---

## Context and Problem Statement

Previously, users imported APIs by supplying individual file paths directly into the collection manager. Each collection stood alone as a flat database entry, lacking workspace grouping, filesystem context, or multi-collection relationship modeling. When working across microservices or multi-file Postman workspaces, users had to import files one by one. Furthermore, adding new collections lacked integration with local project directories, and deleting a collection from the application left obsolete `.json` files behind on disk.

## Decision

Shift to a project-oriented hierarchy where collections belong to parent projects representing directory trees on the local filesystem.

### 1. Dedicated Project Architecture and Separation of Concerns

To preserve modularity and avoid overloading `internal/service/collection`, project operations are isolated into:
- **Domain Model** (`internal/domain/collection.go`): Added `Project` entity (`ID`, `Name`, `Path`, `IsSelected`, timestamps) and updated `Collection` with `ProjectID string` as a foreign key.
- **Project Usecase** (`internal/service/project/usecase.go`): Encapsulates project creation, folder scanning, project listing, and cascading deletion.
- **Project Controller** (`internal/adapter/controller/project/controller.go`): Exposes REST routes under `/project` (`POST /project/create`, `GET /project/list`, `DELETE /project/:id`).
- **Database Storage**: Uses dedicated BoltDB bucket `"Project"` alongside the existing `"Collection"` bucket.

### 2. Automatic Recursive Collection Discovery

When creating a project via `POST /project/create`, the usecase scans the selected folder path recursively using `filepath.WalkDir`:
- Traverses all `.json` files within the project root and subdirectories.
- Skips common hidden/vendor directories (e.g., `.git`, `node_modules`, `.cache`).
- Validates the JSON content against the Postman collection v2.1.0 specification (`info.name` and schema containing `schema.getpostman.com`).
- Automatically creates and persists valid collections linked with `project_id = project.ID`.
- Extracts collection variables (marking `BASE_URL` variables via [[concepts/base-url-lifecycle]]).

### 3. Hierarchical Selection Synchronization

Projects and collections maintain a synchronized active selection state:
- When a user selects a collection via `PUT /collection/select/:id`, the usecase marks `collection.is_selected = true`, unselects other collections, finds the parent project via `collection.ProjectID`, and activates `project.is_selected = true` while deactivating other projects.
- Selecting a parent project selects the project and ensures the UI tree activates contextually for that project.

### 4. Inline Collection Creation & Default DTO Generation

The collection manager dialog (`frontend/src/layout/components/collectionManager/CollectionManage.tsx`) refactors creation from a static bottom form into an inline tree action:
- Bottom form is now dedicated to adding new Projects via folder selection (using Electron's `openFolderDialog`).
- In the project tree, hovering between a project item and its children, or between sibling collection rows, reveals an inline `(+)` separator.
- Clicking `(+)` opens an inline row matching collection item styling, containing:
  - Collection name input.
  - Target folder path picker (defaulting to the parent project's root path or a subfolder).
  - Save button replacing delete button.
- Backend `CreateCollection` writes a default valid Postman v2.1.0 DTO JSON file directly to the selected folder on disk (`<folder>/<name>.json`), then registers it into the database with `project_id`.

### 5. Filesystem File Deletion on Collection Removal

In alignment with [[decisions/file-backed-restrequest-editing]]:
- Deleting a collection (`DELETE /collection/:id`) deletes database records, testsuites, and automation references, and removes the physical `.json` file from disk (`os.Remove`).
- Deleting a project (`DELETE /project/:id`) cascades deletion to all associated child collections and removes their respective files from disk.

## Consequences

- **Filesystem Fidelity**: Local filesystem directories remain the source of truth for collection files.
- **Workflow Efficiency**: Adding a workspace folder imports all service collections instantly.
- **Clean Structure**: Inline creation keeps API authors in the context of their specific project folder hierarchy without extra dialogs.
- **Destructive Deletion**: Deleting collections or projects permanently deletes the corresponding JSON files on disk.

## Related Pages

- [[decisions/file-backed-restrequest-editing]]
- [[patterns/usecase/new-usecase-workflow]]
- [[patterns/controller/controller-base-structure]]
- [[concepts/base-url-lifecycle]]
