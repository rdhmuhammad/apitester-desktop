# Controller Request Handling

**Summary**: HTTP handlers validate incoming data before calling the usecase, pass the request context through, and use shared response helpers for consistent output.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Controller.md`
**Last updated**: 2026-09-04

---

## Handler sequence

1. Declare the feature request type.
2. Call `Enigma.BindAndValidate` with the Gin context.
3. Return `400 Bad Request` with `DefaultInvalidInputFormResponse` when validation fails.
4. Add route parameters using `c.Param` when they are not part of the body.
5. Pass `c.Request.Context()` to the usecase.
6. Map errors with `Mapper.ErrorResponse` or use `Mapper.NewResponse` for a standard success/error envelope.

Handlers should return immediately after validation or mapped errors. They should not duplicate business validation that belongs in the usecase.

## Related pages

- [[patterns/controller/example-of-module-controller]]
- [[patterns/controller/controller-routing-and-middleware]]
