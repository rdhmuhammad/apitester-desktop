# Socket Room Lifecycle

**Summary**: Room membership changes are handled through shared join and leave logic that updates the cache and notifies existing room members.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Socket.md`
**Last updated**: 2026-09-04

---

## Join and leave flow

`JoinRoom` calls `cacheRoom` with the `joining` action, while `LeaveRoom` calls it with `leaving`. The shared handler:

1. Reads and trims `userRef` and `roomId` from the handshake query.
2. Joins the client to the target room.
3. Creates a deadline using the configured socket timeout.
4. Calls the usecase with actor, room, and membership status.
5. Fetches sockets in the room and emits the appropriate join or leave event to other clients.

The action enum and event map keep the two paths consistent:

```go

const (
	leaving actionCache = iota
	joining
)
```

When the room is newly created, the example emits a join notification only when appropriate. Existing members receive the mapped join or leave event.

## Related pages

- [[patterns/socket/example-of-module-socket]]
- [[patterns/socket/socket-event-broadcasting]]
