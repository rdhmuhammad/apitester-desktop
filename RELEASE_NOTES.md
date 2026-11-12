### What's Fixed
- Fixed hover preview popover flickering on wiki-links and transclusions by flipping cleanly above the link when near viewport boundaries and adding a hover close grace delay
- Fixed folder-qualified wiki-links and transclusions (e.g. `[[concept/get-prompt]]`, `![[concept/get-prompt]]`) showing "Target document not found" across editor, embeds, and autocomplete
- Fixed HTTP 400 error when creating notes with folder paths (e.g. `[[concept/test]]`); backend document creation now validates subfolder paths and automatically creates missing parent folders
- Fixed request body `Content-Type` header and body mode (`application/json` vs `multipart/form-data`) synchronization when switching or toggling body content types
- Fixed example response editing race conditions and editor state resets when switching response sources or deleting examples

### What's New
- Added a **Response Raw** collapsible output block in the Response Console tab for both live and example responses (with binary content-type guard)
- Pre-populated newly created example responses with the current response status, headers, and formatted body
