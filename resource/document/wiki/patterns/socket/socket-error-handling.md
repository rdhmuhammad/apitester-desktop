# Socket Error Handling

**Summary**: Socket handlers validate client input early, log operational failures, and translate errors into the socket protocol through the shared mapper.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Socket.md`
**Last updated**: 2026-09-04

---

## Handler rules

- Trim handshake query values before validation.
- Reject a missing `roomId` with a domain validation error.
- Reject a missing `userRef` with an access error.
- Use `Mapper.ErrorSocket` for errors that must reach the client.
- Use the shared logger or error handler for server-side diagnostics.
- Return immediately after reporting an error so the handler does not continue with invalid state.

Room-cache operations additionally use a deadline derived from configuration. This prevents a stalled usecase from holding a socket event indefinitely.

## Related pages

- [[patterns/socket/example-of-module-socket]]
- [[patterns/socket/socket-base-composition]]
