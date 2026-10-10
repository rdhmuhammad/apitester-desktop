---
code: 2-ways-doc-editing
Depedency:
source_code:
Title: Two ways document editing
---
## Problem Statement
- Whenever i edit the collection file from outside apitester environment, the changes is not reflected to the apitester gui. i need to refresh the collection call for it.
- As user, i want gui to show dialog prompt asking if user want to load changes from system (changes from outside apitester) or load mine. so that when 

## Acceptance Criteria
- on [SidebarLayout](D:\personal\apitester-desktop\frontend\src\layout\view\SidebarLayout.tsx) line 169 method handleDragEnd, preaper the tree data with new order
- update the tanstack query state from treeQuery at [useCollection](D:\personal\apitester-desktop\frontend\src\layout\hooks\useCollection.ts) 
- then hit endpoint updateTree at [Controller](D:\personal\apitester-desktop\internal\adapter\controller\restrequest\controller.go) line 64.
- Add loading circle spinning overlay the tree which you give dark background overlay indicating it is loading new update.
## Flow