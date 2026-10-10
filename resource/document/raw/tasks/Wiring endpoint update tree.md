---
code: wiring-endpoint-update-tree
Depedency:
Title: wire the endpoint update tree with SidebarLayout Drag and Drop request.
files:
  - D:\personal\apitester-desktop\internal\adapter\controller\restrequest\controller.go
  - D:\personal\apitester-desktop\frontend\src\layout\view\SidebarLayout.tsx
  - D:\personal\apitester-desktop\frontend\src\layout\hooks\useCollection.ts
---
## Problem Statement

- Wire the existing endpoint update tree with SidebarLayout Drag an Drop request

## Acceptance Criteria
- on [SidebarLayout](D:\personal\apitester-desktop\frontend\src\layout\view\SidebarLayout.tsx) line 169 method handleDragEnd, preaper the tree data with new order
- update the tanstack query state from treeQuery at [useCollection](D:\personal\apitester-desktop\frontend\src\layout\hooks\useCollection.ts) 
- then hit endpoint updateTree at [Controller](D:\personal\apitester-desktop\internal\adapter\controller\restrequest\controller.go) line 64.
- Add loading circle spinning overlay the tree which you give dark background overlay indicating it is loading new update.
## Flow


