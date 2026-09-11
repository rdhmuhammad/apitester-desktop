# API and Socket Registration

**Summary**: The application API composition layer initializes shared infrastructure, injects it into feature modules, registers HTTP routes and Socket.IO namespaces, and starts the server.
**Sources**: `resource/document/raw/patterns/backend/Example of API and Socket Registration.md`
**Last updated**: 2026-09-10

---

## Application composition

The API composition object owns the Gin server, Socket.IO instance, shared infrastructure, and collections of HTTP routers and socket namespaces. Its `Start()` method creates the API root group, registers every router, initializes every socket namespace, and starts Gin on the configured port.

```go
type Router interface {
	Route(handler *gin.RouterGroup)
}

type Namespace interface {
	OnSpace(nsfun cio.NSInitiate)
}

func (a *Api) Start() error {
	root := a.server.Group("/api/v1")
	for _, router := range a.routers {
		router.Route(root)
	}
	for _, namespace := range a.namespaces {
		namespace.OnSpace(a.socket.NewSpace)
	}
	return a.server.Run("0.0.0.0:" + os.Getenv("APP_PORT"))
}
```

The application default constructor is responsible for initializing shared services and connections, such as Gin middleware, Socket.IO, the database, cache, storage, logging, and optional external integrations. Feature modules should receive these dependencies through their constructors rather than creating global connections themselves.

## Module constructors

Each feature entry point is either an HTTP controller or a socket module. Constructors are the dependency-injection boundary: they receive shared connections and base components, then create or configure the feature usecase.

```go
func NewHomepageController(dbConn *gorm.DB, controller base.BaseController, port base.Port) HomepageController {
	return HomepageController{
		BaseController: controller,
		port:           port,
		uc:             homepage.New(dbConn, port),
	}
}

func NewChatSocket(dbConn *gorm.DB, mongoConn *mongodb.Conn, baseSocket base.BaseSocket, prt base.Port) ChatSocket {
	return ChatSocket{
		cachedUc:   caching_chat.NewUsecase(dbConn, mongoConn, prt),
		BaseSocket: baseSocket,
	}
}
```

See [[patterns/controller/example-of-module-controller]] and [[patterns/socket/example-of-module-socket]] for the internal structure of each module type.

## Registration boundary

The registration layer converts application dependencies into module dependencies and stores the resulting modules on the API object. Keep registration separate from server startup so the application entry point can compose all modules in one place.

```go
func (a *Api) RegisterSocket(r func(conns Conns, port base.Port, sct base.BaseSocket) []Namespace) {
	namespaces := r(Conns{Db: a.db, MongoDb: a.mongoConn, KafkaProducer: a.kafkaProducer},
		base.NewPort(a.db, a.cache, a.minioStr, a.reZero),
		base.NewBaseSocket(a.cache, a.db, a.reZero))
	a.namespaces = append(a.namespaces, namespaces...)
}

func (a *Api) Register(r func(conns Conns, port base.Port, controller base.BaseController) []Router) {
	routers := r(Conns{Db: a.db, MongoDb: a.mongoConn, KafkaProducer: a.kafkaProducer},
		base.NewPort(a.db, a.cache, a.minioStr, a.reZero),
		base.NewBaseController(a.db, a.cache))
	a.routers = append(a.routers, routers...)
}
```

`Register` handles HTTP controllers, while `RegisterSocket` handles Socket.IO namespaces. Both functions pass shared dependencies into a callback that returns the concrete modules to register.

## Entry-point wiring

The executable loads configuration, builds the default API, registers controllers and sockets, and starts the server. A module is not active merely because its package exists; it must be returned from the corresponding registration callback.

```go
app := api.Default()

app.Register(func(conn api.Conns, port base.Port, ctrl base.BaseController) []api.Router {
	return []api.Router{
		controller.NewHomepageController(conn.Db, ctrl, port),
	}
})

app.RegisterSocket(func(conns api.Conns, port base.Port, sct base.BaseSocket) []api.Namespace {
	return []api.Namespace{
		socket.NewChatSocket(conns.Db, conns.MongoDb, sct, port),
	}
})

if err := app.Start(); err != nil {
	panic(err)
}
```

## Related pages

- [[patterns/controller/example-of-module-controller]]
- [[patterns/socket/example-of-module-socket]]
- [[patterns/usecase/new-usecase-workflow]]
