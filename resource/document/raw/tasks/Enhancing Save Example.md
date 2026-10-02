---
code: enhance-save-example
Depedency:
Title: Enhanching current save example feature
files:
  - D:\personal\apitester-desktop\internal\service\restrequest\usecase.go
  - D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig
---
## Problem Statement

You will enhance the ability of current save example, to be able to create new request example from scratch

## Acceptance Criteria
- Add button (+) for adding new request example at [ResponseView](file:///D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig\ResponseView.tsx)
- Can remove existing request example
- Can edit request property and response property of exampleResponse at [RequestConfig](D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig) and [ResponseView](file:///D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig\ResponseView.tsx)
- When the request example is selected, user cannot send response there is badge label at  [RequestConfig](D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig) to tell user switch to actual request.
- at [[Save Example]] it is explain they use redux, here you dont need to use redux instead using the current socket adapter from backend [Restrequest/usecase](D:\personal\apitester-desktop\internal\service\restrequest\usecase.go) line 267 SaveResponse.
- you may need to enhance the code for your need.
## Flow
- Flow is explain at [[Save Example]]

