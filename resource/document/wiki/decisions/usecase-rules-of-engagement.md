# Usecase Rules of Engagement Standards

**Summary**: Architectural decision establishing strict code formatting, error propagation, parameter bounds, decomposition limits, and timeout controls for all backend usecase methods.
**Sources**: `resource/document/raw/patterns/backend/Usecase Rule of engagement.md`
**Last updated**: 2026-09-15

---

## Context

As the backend codebase grows across collection management, request execution, and history recording, usecase methods risk accumulating mixed responsibilities, unstructured error returns, unbounded method signatures, and uncoordinated timeouts. 

Without consistent conventions:
- Errors returned without wrapping bypass centralized console logging.
- Methods with dozens of lines without spacing become difficult to scan and maintain.
- Long parameter lists create high coupling and fragile signatures.
- Socket operations executing usecases without timeouts can block indefinitely on slow I/O or deadlocks.

## Decision

All backend usecase methods must adhere to the standardized rules of engagement:

1. **Mandatory Error Logging Entrypoint**: All returned errors must pass through `u.errHandler.ErrorReturn(err)`. This ensures consistent console logging without requiring manual log statements before every `return`.
2. **Context Paragraphing**: Code blocks representing distinct operational stages must be visually isolated with blank lines.
3. **4-Line Single Separation of Concern**: Any sub-context or operational block inside a usecase method spanning more than 4 lines must be extracted to a helper method.
4. **Parameter and Return Budgeting**: Input parameters are capped at 3 (excluding `context.Context`); return values are capped at 2 (excluding `error`). Any excess must be encapsulated into dedicated typed request or response structs.
5. **Struct Encapsulation for State and View**: Field mutations (> 2 lines) must be moved into struct setters; field extractions or presentations (> 2 lines) must be moved into struct getters.
6. **Bounded Socket Lifecycles**: All socket-triggered usecase executions must run under a context with a strict 3-second deadline (`context.WithTimeout(..., 3*time.Second)`). HTTP requests must propagate Gin's request context.

## Consequences

- **Maintainability**: Usecase methods remain high-level workflows that are easy to audit and reason about.
- **Observability**: Error logging is guaranteed across all endpoints through the centralized error handler.
- **Stability**: Socket handlers fail fast instead of hanging or accumulating leaked goroutines.
- **Refactoring Requirement**: Existing usecase implementations that violate these rules must be progressively refactored when touched.

## Related pages

- [[patterns/usecase/usecase-rules-of-engagement]]
- [[patterns/usecase/new-usecase-workflow]]
- [[concepts/backend/usecase-design-rules]]
- [[decisions/index]]
