
Here is the structure of server configuration that initiate the gin server, also responsible to inject dependencies to each module. each module entry point are either controller or socket, here example for both of them.

**Controller/API Endpoint**

```go
type HomepageController struct {  
    base.BaseController  
    port base.Port  
    uc   HomepageUsecase  
}

// constructor for dependency injection
func NewHomepageController(dbConn *gorm.DB, controller base.BaseController, port base.Port) HomepageController {  
    return HomepageController{  
       BaseController: controller,  
       port:           port,  
       uc:             homepage.New(dbConn, port),  
    }  
}

...
```
[[Example of Module Controller]]

**Socket/Socket IO Event Handler**

```go
type ChatSocket struct {  
    base.BaseSocket  
    cachedUc controller.CachedChatUsecase  
}  
  
// constructor for dependency injection
func NewChatSocket(dbConn *gorm.DB, mongoConn *mongodb.Conn, baseSocket base.BaseSocket, prt base.Port) ChatSocket {  
    return ChatSocket{  
       cachedUc:   caching_chat.NewUsecase(dbConn, mongoConn, prt),  
       BaseSocket: baseSocket,  
    }  
}
```
[[Example of Module Socket]]


Then, at `shared/api` create these file

**API**

Act as structure of service, has ability to start the server with method `Start()` file mostly named as `api.go`
```go
package api  
  
import (  
    "os"  
  
    "github.com/rdhmuhammad/phisiobook/pkg/cache"    "github.com/rdhmuhammad/phisiobook/pkg/cio"    "github.com/rdhmuhammad/phisiobook/pkg/kafka"    "github.com/rdhmuhammad/phisiobook/pkg/logger"    "github.com/rdhmuhammad/phisiobook/pkg/miniostorage"    "github.com/rdhmuhammad/phisiobook/pkg/mongodb"  
    "github.com/gin-gonic/gin"    "gorm.io/gorm")  
  
type Api struct {  
    server        *gin.Engine  
    socket        *cio.IO  
    db            *gorm.DB  
    mongoConn     *mongodb.Conn  
    cache         cache.DbClient  
    minioStr      miniostorage.StorageMinio  
    reZero        *logger.ReZero  
    kafkaProducer kafka.ProducerInterface  
    routers       []Router  
    namespaces    []Namespace  
}  
  
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
  
    port := os.Getenv("APP_PORT")  
    err := a.server.Run("0.0.0.0:" + port)  
    if err != nil {  
       return err  
    }  
  
    return err  
}
```

**Default**

This is where you setup all the dependencies that supposed to has connection or passed as pointer to every component in service. mostly name as `default.go`

```go
package api  
  
import (  
    "fmt"  
    "github.com/rdhmuhammad/phisiobook/pkg/cache"    "github.com/rdhmuhammad/phisiobook/pkg/cio"    "github.com/rdhmuhammad/phisiobook/pkg/db"    "github.com/rdhmuhammad/phisiobook/pkg/logger"    "github.com/rdhmuhammad/phisiobook/pkg/middleware"    "github.com/rdhmuhammad/phisiobook/pkg/migrator"    "github.com/rdhmuhammad/phisiobook/pkg/miniostorage"    "github.com/rdhmuhammad/phisiobook/pkg/mongodb"    "os"    "time"  
    "github.com/getsentry/sentry-go"    sentrygin "github.com/getsentry/sentry-go/gin"  
    "github.com/gin-gonic/gin")  
  
func Default() *Api {  
    // Initialize Sentry  
    err := sentry.Init(sentry.ClientOptions{  
       Dsn:              os.Getenv("SENTRY_DSN"),  
       Environment:      os.Getenv("ENVIRONMENT"),  
       TracesSampleRate: 1.0,  
       AttachStacktrace: true,  
       BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {  
          // Add source context for better error tracing  
          return event  
       },  
    })  
    if err != nil {  
       fmt.Printf("Sentry initialization failed: %v\n", err)  
    }  
  
    server := gin.Default()  
  
    server.Use(middleware.AllowCORS())  
  
    // Add Sentry middleware with enhanced configuration  
    server.Use(sentrygin.New(sentrygin.Options{  
       Repanic:         true,  
       WaitForDelivery: false,  
       Timeout:         30 * time.Second,  
    }))  
  
    // Add custom Sentry middleware for request enrichment  
    server.Use(middleware.SentryMiddleware())  
  
    socket := cio.New(server)  
  
    dbConn, err := db.Default()  
    if err != nil {  
       panic(fmt.Sprintf("panic at db connection: %s", err.Error()))  
    }  
  
    if err := migrator.Up(dbConn); err != nil {  
       panic(fmt.Sprintf("panic at migration: %s", err.Error()))  
    }  
  
    //  
    dbCache := cache.Default()  
    //  
    minioConn := miniostorage.NewConnection(miniostorage.Conn{  
       Endpoint:  os.Getenv("MINIO_ENDPOINT"),  
       Bucket:    os.Getenv("MINIO_BUCKET"),  
       AccessKey: os.Getenv("MINIO_ACCESS_KEY"),  
       SecretKey: os.Getenv("MINIO_SECRET_KEY"),  
    })  
  
    mongoConn := mongodb.NewConnection(mongodb.Connection{  
       Username: os.Getenv("MONGODB_USERNAME"),  
       Password: os.Getenv("MONGODB_PASSWORD"),  
       Host:     os.Getenv("MONGODB_HOST"),  
       Port:     os.Getenv("MONGODB_PORT"),  
       Database: os.Getenv("MONGODB_DATABASE"),  
    })  
  
    reZero := logger.DefaultLogger()  
  
    //kafkaProducer, err := kafka.NewProducer()  
    //if err != nil {    // reZero.Errorf("WARNING: kafka connection failed: %v\n", err)    //}  
    return &Api{  
       mongoConn: mongoConn,  
       server:    server,  
       socket:    socket,  
       db:        dbConn,  
       cache:     dbCache,  
       minioStr:  minioConn,  
       reZero:    &reZero,  
       //kafkaProducer: kafkaProducer,  
    }  
}

```

**Register**

It consist blueprint of method that use for registering socket or controller, for every globally use dependencies like db connection, logger or any base component are assign here. mostly name `register.go`

```go

package api  
  
import (  
    "github.com/rdhmuhammad/phisiobook/pkg/kafka"  
    "github.com/rdhmuhammad/phisiobook/pkg/mongodb"    "github.com/rdhmuhammad/phisiobook/shared/base"  
    "gorm.io/gorm")  
  
type Conns struct {  
    Db            *gorm.DB  
    MongoDb       *mongodb.Conn  
    KafkaProducer kafka.ProducerInterface  
}  
  
func (a *Api) RegisterSocket(r func(conns Conns, port base.Port, sct base.BaseSocket) []Namespace) {  
    namespaces := r(Conns{  
       Db:            a.db,  
       MongoDb:       a.mongoConn,  
       KafkaProducer: a.kafkaProducer,  
    },  
       base.NewPort(a.db, a.cache, a.minioStr, a.reZero),  
       base.NewBaseSocket(a.cache, a.db, a.reZero),  
    )  
  
    for _, namespace := range namespaces {  
       a.namespaces = append(a.namespaces, namespace)  
    }  
  
}  
  
func (a *Api) Register(r func(conns Conns, port base.Port, controller base.BaseController) []Router) {  
    routers := r(Conns{  
       Db:            a.db,  
       MongoDb:       a.mongoConn,  
       KafkaProducer: a.kafkaProducer,  
    },  
       base.NewPort(a.db, a.cache, a.minioStr, a.reZero),  
       base.NewBaseController(a.db, a.cache),  
    )  
  
    for _, router := range routers {  
       a.routers = append(a.routers, router)  
    }  
}
```

Then, at `cmd/api/api.go` you can register the controller or event socket like this

```go
package main  
  
import (  
    "flag"  
  
    iam "iam_module/shared/adapter/controller"  
  
    "github.com/rdhmuhammad/phisiobook/internal/adapter/controller"    "github.com/rdhmuhammad/phisiobook/internal/adapter/socket"    "github.com/rdhmuhammad/phisiobook/pkg/api"    "github.com/rdhmuhammad/phisiobook/shared/base"  
    "log"  
    "github.com/joho/godotenv"    _ "github.com/joho/godotenv/autoload"  
)  
  
func main() {  
    var envFile string  
    flag.StringVar(&envFile, "env", ".env.stag", "Provide env file path")  
    flag.Parse()  
  
    err := godotenv.Load(envFile)  
    if err != nil {  
       log.Println(err)  
       panic(err)  
  
    }  
  
    app := api.Default()  
  
    // ========================= REGISTER CONTROLLER =========================  
    app.Register(func(conn api.Conns, port base.Port, ctrl base.BaseController) []api.Router {  
       return []api.Router{  
          controller.NewHomepageController(conn.Db, ctrl, port),  
          iam.NewAuthController(conn.Db, port, ctrl),  
          controller.NewHealthController(conn.Db, ctrl, port),  
          iam.NewUserManagementController(conn.Db, port, ctrl),  
          controller.NewChatController(conn.Db, conn.MongoDb, ctrl, port),  
          controller.NewHistoryController(conn.Db, ctrl, port),  
          controller.NewBookingController(conn.Db, conn.MongoDb, port, ctrl),  
          controller.NewServiceController(conn.Db, port, ctrl),  
          controller.NewTherapistController(conn.Db, port, ctrl),  
          controller.NewEmployeeController(conn.Db, port, ctrl),  
          controller.NewDashboardController(conn.Db, port, ctrl),  
          controller.NewBookingManagementController(conn.Db, port, ctrl),  
          controller.NewPaymentManagementController(conn.Db, port, ctrl),  
          controller.NewReportsController(conn.Db, port, ctrl),  
       }  
    })  
  
    app.RegisterSocket(func(conns api.Conns, port base.Port, sct base.BaseSocket) []api.Namespace {  
       return []api.Namespace{  
          socket.NewChatSocket(conns.Db, conns.MongoDb, sct, port),  
       }  
    })  
  
    err = app.Start()  
    if err != nil {  
       panic(err)  
    }  
  
}

```