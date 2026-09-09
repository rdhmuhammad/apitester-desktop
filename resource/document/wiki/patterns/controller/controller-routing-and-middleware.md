# Controller Routing And Middleware

**Summary**: A controller exposes a `Route` method that groups feature endpoints and attaches security, authorization, and idempotency middleware at the route boundary.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Controller.md`
**Last updated**: 2026-09-04

---

## Route composition

The example groups endpoints under `/booking`. Protected operations apply `Security.Validate`, then authorize the required role. The create endpoint also applies idempotency protection before executing the handler.

Middleware should be applied according to the endpoint's requirements rather than duplicated inside handlers. Public and authenticated endpoints can coexist in the same feature group, as shown by the unprotected adjust-price route and protected booking mutations.

When a route can be retried by clients, use the idempotency middleware with a stable operation key and actor field. Keep route strings and authorization roles close to the route definition so the module's external contract is easy to inspect.

## Related pages

- [[patterns/controller/example-of-module-controller]]
- [[patterns/controller/controller-request-handling]]
