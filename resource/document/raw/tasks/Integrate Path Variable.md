---
code: integrate-path-variable
Depedency:
Title: integrate path variable to tab Params
files:
---

### Problem Statement

you will enhance the params tab to have separate table for query param and path variable. at [ParamsContent](D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig\ParamsContent.tsx)

## Acceptance Criteria
- add new table for path variables, separate table with existing query params give title to each table for indicate path variable and query param. the table only exists when user type pattern `:word` to endpoint at [`RequestHeader`](D:\personal\apitester-desktop\frontend\src\layout\components\header\RequestHeader.tsx)
- do not allow user to have 2 or more path variable with same key
- User can only modify field value at Path Variable table
- when user type `:anyword` to endpoint, eg: `/api/v1/user/:userId` userId is variable key. add one item to Path Variable table.
- enhance socket event method `UpdateURL` file [`restrequest.go`](D:\personal\apitester-desktop\internal\adapter\socket\restrequest\restrequest.go)
- add new socket event method `EditPathVariable` to [`restrequest.go`](D:\personal\apitester-desktop\internal\adapter\socket\restrequest\restrequest.go)
- at [`useSendRequest.go`](D:\personal\apitester-desktop\frontend\src\layout\hooks\useSendRequest.ts) endpoint should resolve value from `Request.Url.Variable`
## Flow

**Modify endpoint/variable key**
- at socket event method  `UpdateURL`, file  [`restrequest.go`](D:\personal\apitester-desktop\internal\adapter\socket\restrequest\restrequest.go), enhance the logic
- grab all value start with `:` in  `Request.URL.Path`
- then loop through `Request.URL.Variable[]`
- check value from `path` start with `:` against `Request.Url.Variable[i].Key`
- check if there are orphan item at `Request.URL.Variable[]`, remove it
- check if there is no variable for specific path item, add new
- Variable dto is struct field id, key and value [`collection/dto.go`](D:\personal\apitester-desktop\internal\service\collection\dto.go)

**Modify Path variable value**
- payload containing key and value
- update value `Request.Url.Variable[i]` check by Key
