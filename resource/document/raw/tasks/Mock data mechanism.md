
## Problem Statement
- We are going to serve mock data for several occasion so that user can easily fill the request parameter and payload. e g: address name, people name.


## Acceptance Criteria
- modify endpoint [`collection/controller.go`](D:\personal\apitester-desktop\internal\adapter\controller\collection\controller.go) line 189, SearchVariables
	- add this list of available mock [[Available Mock Category]]]] to list.
	- modify the list dto from only string of keyname to dto with field key string, type (variable, mock)
	- variable should always be at first indexes of array then mock going after it
- Use https://github.com/brianvoe/gofakeit for source of mock data at backend
- modify list of [Variable Dialog](D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig\VariableDialog.tsx) to show little badge with dot of type (from endpoint=> data only variable or mock) next to key. give different color for different type.
- create endpoint to resolve the value of variable and mock based on key, it return single string. to  [`collection/controller.go`](D:\personal\apitester-desktop\internal\adapter\controller\collection\controller.go), 
- use the new endpoint to resolve variable value and value at [tooltip variable dialog ](D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig\VariableInput.tsx)
- at  [tooltip variable dialog ](D:\personal\apitester-desktop\frontend\src\pages\editor\components\RequestConfig\VariableInput.tsx), when the hover is over badge of mock data just show text "calculate during send request"
- create endpoint at [restrequest/controller.go](D:\personal\apitester-desktop\internal\adapter\controller\restrequest\controller.go) GetMockData, parse mock data key to get return value from mock the type can be string, int, float.
- then use the endpoint to resolve mock data value while at [env resolve](D:\personal\apitester-desktop\frontend\src\layout\hooks\useEnvResolve.ts), [send request](D:\personal\apitester-desktop\frontend\src\layout\hooks\useSendRequest.ts)
- when using the mock at input, mock always start with mock., e g `{{mock.bookName}}`
## Flow


