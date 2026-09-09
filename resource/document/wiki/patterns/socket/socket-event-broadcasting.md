# Socket Event Broadcasting

**Summary**: Socket events are broadcast to peers in a room while the sender receives a direct event, with acknowledgements used to track delivery state.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Socket.md`
**Last updated**: 2026-09-04

---

## Message flow

The chat handler fetches all sockets in the target room. For every other socket it uses `EmitWithAck` with a one-second timeout. A successful acknowledgement marks the message as read and records `ReadAt` in the client's requested timezone. The sender receives a direct `Emit` instead of an acknowledgement flow.

After attempting delivery, the request is persisted asynchronously through `CacheChat`. This keeps the socket callback focused on delivery while retaining read-state information.

Always handle broadcast and acknowledgement errors. A failed acknowledgement marks the message as unread rather than silently treating it as delivered.

## Related pages

- [[patterns/socket/example-of-module-socket]]
- [[patterns/socket/socket-room-lifecycle]]
