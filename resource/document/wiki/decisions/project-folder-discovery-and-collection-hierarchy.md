# Project Folder Discovery and Collection Hierarchy

**Summary**: Refactors collection management into a GoLand-style project switcher workflow where opening a folder creates (or reuses) a Project, recursively discovers valid Postman collection JSON files, allows standalone project selection in the title bar, scopes the Collection Manager to the active project's collections, disables collection-dependent tabs when no collection is active, and enables inline collection creation.
**Sources**: `internal/domain/collection.go`, `internal/service/project/usecase.go`, `internal/service/collection/usecase.go`, `internal/adapter/controller/project/controller.go`, `frontend/src/layout/components/header/ProjectSwitcher.tsx`, `frontend/src/layout/components/collectionManager/CollectionManage.tsx`, `frontend/src/layout/components/collectionManager/index.tsx`, `frontend/src/layout/view/SidebarLayout.tsx`
**Last updated**: 2026-10-25

---

## Context and Problem Statement

Previously, users imported APIs by supplying individual file paths directly into the collection manager. Each collection stood alone as a flat database entry, lacking workspace grouping, filesystem context, or multi-collection relationship modeling. When working across microservices or multi-file Postman workspaces, users had to import files one by one. Furthermore, adding new collections lacked integration with local project directories, and deleting a collection from the application left obsolete `.json` files behind on disk.

## Decision

Shift to a project-oriented hierarchy where collections belong to parent projects representing directory trees on the local filesystem.

### 1. Dedicated Project Architecture and Separation of Concerns

To preserve modularity and avoid overloading `internal/service/collection`, project operations are isolated into:
- **Domain Model** (`internal/domain/collection.go`): Added `Project` entity (`ID`, `Name`, `Path`, `IsSelected`, timestamps) and updated `Collection` with `ProjectID string` as a foreign key.
- **Project Usecase** (`internal/service/project/usecase.go`): Encapsulates project opening (deduplicating by path), folder scanning, project selection, project listing, and cascading deletion.
- **Project Controller** (`internal/adapter/controller/project/controller.go`): Exposes REST routes under `/project` (`POST /project/open`, `PUT /project/select/:id`, `GET /project/list`, `PUT /project/:id`, `DELETE /project/:id`).
- **Database Storage**: Uses dedicated BoltDB bucket `"Project"` alongside the existing `"Collection"` bucket.

### 2. Automatic Recursive Collection Discovery

When opening a project via `POST /project/open`, if a project with the normalized path does not yet exist, the usecase creates the project (naming it after the folder base name if `name` is omitted) and scans the selected folder path recursively using `filepath.WalkDir`:
- Traverses all `.json` files within the project root and subdirectories.
- Skips common hidden/vendor directories (e.g., `.git`, `node_modules`, `.cache`).
- Validates the JSON content against the Postman collection v2.1.0 specification (`info.name` and schema containing `schema.getpostman.com`).
- Automatically creates and persists valid collections linked with `project_id = project.ID`.
- Extracts collection variables (marking `BASE_URL` variables via [[concepts/base-url-lifecycle]]).

### 3. GoLand-Style Project Switcher & Independent Project Selection

Projects and collections maintain a coordinated selection model where a project can be selected independently of any collection:
- **Title Bar Switcher** (`frontend/src/layout/components/header/ProjectSwitcher.tsx`): Located in the title bar next to the app name, showing a colored initials avatar and active project name. Its dropdown provides **Open...** (native folder picker -> `POST /project/open`) and an **Open Projects** list (`PUT /project/select/:id`) with a confirmation-guarded delete (`DELETE /project/:id`).
- **Selecting a Project** (`PUT /project/select/:id`): Marks the target project `is_selected = true` and all other projects `false`. Any selected collection belonging to a different project is unselected (`clearForeignCollectionSelection`), leaving the workspace with an active project and no active collection. Re-selecting the already active project preserves its active collection.
- **Selecting a Collection** (`PUT /collection/select/:id`): Marks `collection.is_selected = true`, unselects other collections, and ensures the parent project is marked `is_selected = true`.
- **Scoped Collection Listing** (`GET /collection/list`): Returns only collections belonging to the currently selected project (or an empty slice when no project is selected).
- **UI Gating When No Collection Is Active**:
  - In `CollectionManager` (`frontend/src/layout/components/collectionManager/index.tsx`), the **Variables**, **Scripts**, and **Auth Manager** tabs are disabled when there is no active collection, forcing focus to the **Collections** tab.
  - In `SidebarLayout` (`frontend/src/layout/view/SidebarLayout.tsx`), only the Collections tree is empty when no collection is selected; project-level sections ( such as `DocumentationSidebar`, `TestScenarioSidebar`, and `AutomationSidebar`) remain visible for the selected project.

### 4. Scoped Collection Manager & Inline Collection Creation

The collection manager dialog (`frontend/src/layout/components/collectionManager/CollectionManage.tsx`) displays only the active project and its collections:
- Header bar shows the active project's name, path, and a button to change the project folder path.
- In the collection list, hovering between collection rows reveals an inline `(+)` separator.
- Clicking `(+)` opens an inline row matching collection item styling, containing:
  - Collection name input.
  - Target folder path picker (defaulting to the parent project's root path or a subfolder).
  - Save button replacing delete button.
- Backend `CreateCollection` writes a default valid Postman v2.1.0 DTO JSON file directly to the selected folder on disk (`<folder>/<name>.json`), then registers it into the database with `project_id`.

### 5. Filesystem File Deletion on Collection Removal

In alignment with [[decisions/file-backed-restrequest-editing]]:
- Deleting a collection (`DELETE /collection/:id`) deletes database records, testsuites, and automation references, and removes the physical `.json` file from disk (`os.Remove`).
- Deleting a project (`DELETE /project/:id`) detaches the project by deleting its database record and cascading DB deletion to its child collection records (`collectionRepo`, `testSuiteRepo`, `automationRepo`), while leaving all files and folders on disk intact.

## Consequences

- **Filesystem Fidelity**: Local filesystem directories remain the source of truth for collection files.
- **Workflow Efficiency**: Adding a workspace folder imports all service collections instantly.
- **Clean Structure**: Inline creation keeps API authors in the context of their specific project folder hierarchy without extra dialogs.
- **Destructive Collection Deletion**: Deleting an individual collection permanently deletes its corresponding JSON file on disk, whereas removing a project only detaches it from the database.

## Related Pages

- [[decisions/file-backed-restrequest-editing]]
- [[patterns/usecase/new-usecase-workflow]]
- [[patterns/controller/controller-base-structure]]
- [[concepts/base-url-lifecycle]]
