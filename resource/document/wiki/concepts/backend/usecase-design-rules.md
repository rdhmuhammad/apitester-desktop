# Usecase Design Rules

**Summary**: Architectural concepts and structural standards governing usecase orchestration, error wrapping, parameter encapsulation, and execution lifetimes in the Go backend.
**Sources**: `resource/document/raw/patterns/backend/Usecase Rule of engagement.md`
**Last updated**: 2026-09-15

---

## Core Concept

In Clean Architecture, usecases represent application-specific business workflows. They orchestrate the flow of data between entities, repositories, and external adapters. To prevent usecases from degrading into bloated, procedural scripts, the codebase enforces strict boundaries between orchestration, low-level manipulation, and entity lifecycle management.

## Orchestration vs. Implementation

A usecase method should read like a table of contents or high-level outline of the business transaction. It coordinates steps such as:
1. Concurrency control (locks)
2. Entity retrieval
3. Authorization & validation
4. State transitions & persistence
5. Audit & history recording
6. Response generation

When any single business step requires more than 4 lines of implementation, it violates the Single Separation of Concern principle and must be delegated to a focused private helper.

## Struct Encapsulation (Domain-Driven Setters and Getters)

Usecases must not perform multi-line manual surgery on internal struct fields. 
- **Setters**: Encapsulate multi-line assignments, default evaluations, or validation rules directly on domain models.
- **Getters**: Encapsulate multi-line transformation, masking, or formatting logic required to present data to callers.

This practice keeps domain knowledge co-located with the data models and prevents duplication across multiple usecases.

## Parameter Budgeting (Command Objects)

Signatures with many parameters hide intent and make refactoring error-prone. By restricting usecase methods to at most 3 input parameters and 2 return values (outside `context.Context` and `error`), the architecture mandates typed command (request) and result (response) structs. This facilitates backwards-compatible evolution and clear API contracts.

## Centralized Observability

Console logging of application failures is centralized at the error boundary using `u.errHandler.ErrorReturn(err)`. Usecase logic never needs ad-hoc `log.Println` statements before returning errors; wrapping ensures that every failure is consistently intercepted, recorded, and formatted.

## Related pages

- [[patterns/usecase/usecase-rules-of-engagement]]
- [[decisions/usecase-rules-of-engagement]]
- [[patterns/usecase/new-usecase-workflow]]
- [[concepts/index]]
