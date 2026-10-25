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

- Wire the existing update tree with SidebarLayout Drag an Drop request

hai many nem is ridho muhammad lah ini mau coba dlu lah **iya **boy dimana ini ya

## Acceptance Criteria

- on [SidebarLayout](D:\personal\apitester-desktop\frontend\src\layout\view\SidebarLayout.tsx) line 169 method handle, preaper the tree data with new order
- update the tanstack query state from treeQuery at [useCollection](D:\personal\apitester-desktop\frontend\src\layout\hooks\useCollection.ts)
- then hit endpoint updateTree at [Controller](D:\personal\apitester-desktop\internal\adapter\controller\restrequest\controller.go) line 64.
- Add loading circle spinning overlay the tree you give dark background indicating it is loading new update

| Header 2 | Header 3 |
| --- | --- |
| Cell 2 | Cell 3 |
| Cell 2 | Cell 3 |