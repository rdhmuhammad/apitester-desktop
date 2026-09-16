
## Writing a usecase logic

1. for every error return wrap with `logger.ErroReturn(err)` where it will act as entry point for logging error to console. Here example Note: if error is `localerror.InvalidData` or `localerror.*` dont wrapped with `ErrorReturn`
 ```go
type Usecase struct {  
    errHandler     localerror.HandleError  
    ...
}

...
func (u *Usecase) Example(id string) (ExampleResponse, error) {
   ...
   if err != nil{
      return ExampleResponse{}, u.errHandler.ErrorReturn(err)
   }
   ...
}
 ```

2. Add enter new line after combination of code block that belong to one context, here what i mean
	a. Example of bad writing
	
```go
func (u *Usecase) SaveResponse(collectionID, requestID string, req SaveResponseRequest) (RequestResponse, error) {  
    u.WriteMu.Lock()  
    defer u.WriteMu.Unlock()  
    collection, docs, content, err := u.loadCollection(collectionID)  
    if err != nil {  
       return RequestResponse{}, err  
    }
    item := findRequest(docs.Item, requestID)  
    if item == nil || item.Request == nil {  
       return RequestResponse{}, localerror.InvalidData("Request not found")  
    }  
    updated, err := u.saveCollection(collection, docs)  
    if err != nil {  
       return RequestResponse{}, err  
    }  
    if err := u.RecordHistory(collection, requestID, "save_response", "response", oldValue, newResponse, content, updated); err != nil {  
       return RequestResponse{}, err  
    }  
    return requestResponse(collection, updated, item), nil  
}
```

	b. Example of good writing

```go
func (u *Usecase) SaveResponse(collectionID, requestID string, req SaveResponseRequest) (RequestResponse, error) {  
    u.WriteMu.Lock()  
    defer u.WriteMu.Unlock()
      
    collection, docs, content, err := u.loadCollection(collectionID)  
    if err != nil {  
       return RequestResponse{}, err  
    }  
    
    item := findRequest(docs.Item, requestID)  
    if item == nil || item.Request == nil {  
       return RequestResponse{}, localerror.InvalidData("Request not found")  
    }  
    
    updated, err := u.saveCollection(collection, docs)  
    if err != nil {  
       return RequestResponse{}, err  
    }  
    
    if err := u.RecordHistory(collection, requestID, "save_response", "response", oldValue, newResponse, content, updated); err != nil {  
       return RequestResponse{}, err  
    }  
    
    return requestResponse(collection, updated, item), nil  
}
```

3. suppose one business context at a usecase method consist more than 4 line of code then these whole line of code need to be extracted to new method (We call it Single **Separation of Concern** ) Note: only block of codes that consist so many external method call or function, if it is only simple if else, calculation you should keep it as it is
4. A method should only has maximal 3 parameters apart from `context.Context`, if method need more than 3 parameter then you should combine it to one struct.
5. A method should only has maximal 2 parameters apart from `error`, if method need more than 2 parameter then you should combine it to one struct.
6. An if else block that need more than 2 condition should turn into `select case`
7. block of code that purpose only for assign value to field in struct, and consist more than 2 line of code. move the logic to be setter of the struct (especially if it used everywhere)
8. for block of code that has same condition like number 7 but for construct the value on field to be render, move the logic to be getter of the struct
9. Always parse `context.Context` to usecase, at controller you can use context from gin at socket create new context with deadline for 3 seconds