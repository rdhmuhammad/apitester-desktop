# Usecase Rules of Engagement

**Summary**: Mandatory implementation rules and coding constraints that every Go usecase method must follow, including error wrapping, visual context spacing, parameter limits, method extraction, struct encapsulation, and context propagation.
**Sources**: `resource/document/raw/patterns/backend/Usecase Rule of engagement.md`
**Last updated**: 2026-09-15

---

## Overview

All usecase logic in the backend must adhere strictly to these rules of engagement. These constraints enforce separation of concerns, consistent observability, maintainable method signatures, and bounded operational lifecycles.

## Rule 1: Wrap Error Returns with Logger

Every returned error from a usecase method must be wrapped with `u.errHandler.ErrorReturn(err)`. This serves as the centralized entry point for logging errors to the console. **Note:** if the error is `localerror.InvalidData` or any `localerror.*`, do not wrap it with `ErrorReturn`.

```go
type Usecase struct {
    errHandler localerror.HandleError
    // ...
}

func (u *Usecase) Example(ctx context.Context, id string) (ExampleResponse, error) {
    // ...
    if err != nil {
        // Only wrap non-localerror types
        return ExampleResponse{}, u.errHandler.ErrorReturn(err)
    }
    // ...
    return response, nil
}
```

Never return raw errors directly out of usecase methods without running them through the configured error handler, unless they are expected local errors.

## Rule 2: Visual Separation Between Context Blocks

Separate logical steps within a usecase method using empty lines. Group lines that belong to the same operational context (e.g., locking, data retrieval, validation, mutation, history recording, response construction) and place a newline between different contexts.

### Bad Example (Continuous Block)

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

### Good Example (Context Paragraphing)

```go
func (u *Usecase) SaveResponse(collectionID, requestID string, req SaveResponseRequest) (RequestResponse, error) {  
    u.WriteMu.Lock()  
    defer u.WriteMu.Unlock()
      
    collection, docs, content, err := u.loadCollection(collectionID)  
    if err != nil {  
       return RequestResponse{}, u.errHandler.ErrorReturn(err)  
    }  
    
    item := findRequest(docs.Item, requestID)  
    if item == nil || item.Request == nil {  
       return RequestResponse{}, u.errHandler.ErrorReturn(localerror.InvalidData("Request not found"))  
    }  
    
    updated, err := u.saveCollection(collection, docs)  
    if err != nil {  
       return RequestResponse{}, u.errHandler.ErrorReturn(err)  
    }  
    
    if err := u.RecordHistory(collection, requestID, "save_response", "response", oldValue, newResponse, content, updated); err != nil {  
       return RequestResponse{}, u.errHandler.ErrorReturn(err)  
    }  
    
    return requestResponse(collection, updated, item), nil  
}
```

## Rule 3: Single Separation of Concern (Max 4 Lines per Context)

If a distinct business step or context within a usecase method exceeds **4 lines of code**, that entire block must be extracted into a dedicated private helper method. This keeps the primary usecase method as a high-level orchestration pipeline rather than a repository of low-level data manipulations. **Note:** This only applies to blocks of code that consist of many external method calls or functions. If it is only simple `if else` branching or calculations, you should keep it as it is without extracting.

## Rule 4: Maximum 3 Input Parameters Apart from Context

A usecase method must have at most **3 input parameters** in addition to `context.Context`. If an operation requires more than 3 arguments, bundle them into a single typed request struct:

```go
// Bad: Too many parameters
func (u *Usecase) UpdateEndpoint(ctx context.Context, colID, reqID, url, method string, auth AuthConfig) error

// Good: Encapsulated in struct
type UpdateEndpointRequest struct {
    CollectionID string
    RequestID    string
    URL          string
    Method       string
    Auth         AuthConfig
}

func (u *Usecase) UpdateEndpoint(ctx context.Context, req UpdateEndpointRequest) error
```

## Rule 5: Maximum 2 Return Values Apart from Error

A usecase method must return at most **2 values** in addition to `error`. When an operation produces more than 2 result values, combine them into a dedicated response struct:

```go
// Bad: Too many return values
func (u *Usecase) Process(ctx context.Context, id string) (EntityA, EntityB, Meta, error)

// Good: Encapsulated in response struct
type ProcessResponse struct {
    A    EntityA
    B    EntityB
    Meta Meta
}

func (u *Usecase) Process(ctx context.Context, id string) (ProcessResponse, error)
```

## Rule 6: Replace Complex Branching with Select / Switch

If an `if-else` block requires more than 2 conditions or branches, refactor the branching logic into a `switch` statement (or a `select case` when coordinating channel operations and context cancellation). Avoid long chains of nested or consecutive `if-else if-else` statements.

## Rule 7: Struct Field Assignment to Setters (> 2 Lines)

If a code block exists solely to assign values to struct fields and spans more than **2 lines of code**, move the assignment logic to a setter method on the struct. This is especially important for models that are reused across usecases or layers.

```go
// Instead of inlining field assignments in the usecase:
reqAuth.Type = req.Type
reqAuth.Bearer = reqBearer
reqAuth.AuthSource = req.AuthSource

// Move to a struct setter:
func (a *ReqAuth) SetFromRequest(req UpdateAuthRequest, bearer []Property) {
    a.Type = req.Type
    a.Bearer = bearer
    a.AuthSource = req.AuthSource
}
```

## Rule 8: Struct Field Presentation to Getters (> 2 Lines)

If a code block spans more than **2 lines of code** to inspect, transform, or construct struct values for rendering or serialization, encapsulate that logic into a getter method on the struct.

## Rule 9: Strict Context Propagation and Lifecycles

Always pass `context.Context` to usecase methods:
- **HTTP Controllers**: Pass the active request context from Gin via `c.Request.Context()`.
- **Socket Handlers**: Create a fresh context with a **3-second deadline** for every usecase invocation to ensure socket operations fail fast and cannot hang:

```go
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()

resp, err := u.usecase.Execute(ctx, payload)
```

## Related pages

- [[patterns/usecase/new-usecase-workflow]]
- [[patterns/usecase/index]]
- [[decisions/usecase-rules-of-engagement]]
- [[concepts/backend/usecase-design-rules]]
- [[patterns/controller/controller-request-handling]]
- [[patterns/socket/socket-error-handling]]
