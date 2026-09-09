# Create New Module Socket

**Summary**: A socket module is composed from a socket struct, a constructor, event handler methods, and an `OnSpace` registration method. The example implements a chat namespace with authentication, room membership, message broadcasting, persistence, and socket-specific error mapping.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Socket.md`
**Last updated**: 2026-09-08

---

## Module structure

Start with a struct that embeds [[patterns/socket/socket-base-composition]] and stores the usecase needed by socket events. The constructor receives infrastructure dependencies and returns a configured module:

```go
type ChatSocket struct {
	base.BaseSocket
	cachedUc controller.CachedChatUsecase
}

func NewChatSocket(
	dbConn *bbolt.DB,
	mongoConn *mongodb.Conn,
	baseSocket base.BaseSocket,
	prt base.Port,
) ChatSocket {
	return ChatSocket{
		cachedUc:   caching_chat.NewUsecase(dbConn, mongoConn, prt),
		BaseSocket: baseSocket,
	}
}
```

If a socket module constructs a usecase that depends on `db.RepositoryInterface`, pass the shared `*bbolt.DB` to that usecase constructor. The usecase creates each entity-specific repository with `db.NewRepository`; do not obtain repositories from a shared `initRepositories` helper in `shared/api/default.go`. A socket constructor may still receive an already-defined usecase interface when repository wiring belongs to the application composition boundary.

## Creation workflow

1. Define the socket struct and embed the project's base socket so shared environment, security, error, and mapping facilities are available.
2. Add the usecase interface or implementation required by the socket events.
3. Add a constructor that receives the database connection and shared socket dependencies, then initializes the usecase. Repository-backed usecases create their typed repositories from `*bbolt.DB` internally.
4. Implement event handlers as methods on the socket struct.
5. Validate handshake values before executing work. The example requires `roomId` and `userRef` for chat operations.
6. Use a bounded context for operations that can block, such as joining or leaving a room.
7. Map failures to the client with `Mapper.ErrorSocket` and log unexpected errors.
8. Register the namespace and events in `OnSpace`.

## Event registration

The `OnSpace` method is the module's registration boundary:

```go
func (ctrl ChatSocket) OnSpace(ns cio.NSInitiate) {
	ns("chat", nil).
		UserRoom().
		Auth(ctrl.Security.SocketValidate("token", "userRef")).
		Connect(ctrl.JoinRoom).
		Event(payload.Message.Topic(), &payload.ChatMessage{}, ctrl.SendChat).
		Disconnect(ctrl.LeaveRoom).Build()
}
```

This configures the `chat` namespace, enables user rooms, authenticates the handshake, and maps connect, message, and disconnect events to handler methods.

## Room and message behavior

`JoinRoom` and `LeaveRoom` delegate to a shared room-cache operation. The handler reads `userRef` and `roomId`, joins the client to the room, invokes the usecase, and notifies other room members through [[patterns/socket/socket-room-lifecycle]].

`SendChat` validates the room and actor, resolves the requested timezone, sends the message to other room members with an acknowledgement timeout, sends it back to the current client, and asynchronously persists the result. See [[patterns/socket/socket-event-broadcasting]] for the delivery pattern.

## Related pages

- [[patterns/socket/socket-base-composition]]
- [[patterns/socket/socket-room-lifecycle]]
- [[patterns/socket/socket-event-broadcasting]]
- [[patterns/socket/socket-error-handling]]
- [[patterns/usecase/new-usecase-workflow]]
