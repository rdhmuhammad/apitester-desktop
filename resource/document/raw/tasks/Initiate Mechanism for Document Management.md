
## Problem Statement
- **As User, I want** to create new document (markdown file), **so that** i can pour my idea to document with document editor [[Initiate Page type Document]]
- **As User, I want** that all my document (markdown file) is showed at Sidebar which also show folder same as actual system folder tree, **so that** i can select the document, delete document or folder, and create new folder.


## Acceptance Criteria

**Create new Document**
- Add new dropdown item for create document at [page/editor/index](D:\personal\apitester-desktop\frontend\src\pages\editor\index.tsx) line 222.
- Enhance [store type](D:\personal\apitester-desktop\frontend\src\pages\editor\types\editor.ts) and [editor slices](D:\personal\apitester-desktop\frontend\src\app\slices\editorTabsSlice.ts) to accept document type.
- there will be adjustments at  [page/editor/index](D:\personal\apitester-desktop\frontend\src\pages\editor\index.tsx) for behavior
	- enabling create new document
	- edit document title
- create endpoint at new module `documentation` for create new document, it is create new file at root project as md file.

**Sidebar tree for Document**
- show all the folder, document md, document html
- behavior
	- when click folder it is toggle expand tree
	- when click document md it is open document to editor document
	- when click document html it is open html to external browser
- can delete, drag and drop item.

### Editor document
- see [[Initiate Page type Document]]
## Flow


