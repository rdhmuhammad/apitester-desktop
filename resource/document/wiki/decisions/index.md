# Decisions

**Summary**: Index of explicit technical decisions recorded for the API Tester codebase.
**Sources**: `resource/document/raw/concepts/backend/IDE Like File Editor Design.md`, `resource/document/raw/patterns/backend/Usecase Rule of engagement.md`
**Last updated**: 2026-10-21

---

- [[decisions/desktop-production-build]] - Production packaging pipeline for Windows service backend, portable Electron frontend, and Inno Setup installer.
- [[decisions/file-backed-restrequest-editing]] - Filesystem-backed request editing with serialized direct writes and no current version check.
- [[decisions/collection-history-for-restrequest-mutations]] - Append-only audit records with old and new content hashes for successful mutations.
- [[decisions/debounced-request-config-mutations]] - Frontend debounce, optimistic cache, version coordination, and serialized request configuration mutations.
- [[decisions/usecase-rules-of-engagement]] - Standardized usecase method complexity, error reporting, struct encapsulation, and execution context limits.
- [[decisions/google-drive-service-account-sync]] - Architecture, security permissions, and step-by-step setup for syncing Playwright test reports to Google Drive.
- [[decisions/playwright-cumulative-test-caching]] - Incremental test scenario caching pipeline to prevent RAM exhaustion and preserve cumulative reports.
- [[decisions/project-folder-discovery-and-collection-hierarchy]] - Project-based folder discovery, parent-child collection hierarchy, inline creation, and disk file deletion.
- [[decisions/documentation-management-and-markdown-editor]] - Pure filesystem `.md`/`.html` documentation tree discovery, file-only drag-and-drop relocation, and live Markdown editor with 500ms debounced UTF-16 slice socket synchronization.


## Related pages

- [[index]]
