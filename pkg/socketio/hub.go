package socketio

import (
	"context"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/zishang520/socket.io/servers/socket/v3"
	"github.com/zishang520/socket.io/v3/pkg/types"
)

type Options struct {
	Port     string
	Endpoint string
}

type IO struct {
	socket     *socket.Server
	clients    chan *socket.Socket
	errHandler localerror.HandleError
	ns         map[string]*NS
	srv        *http.Server
}

func New(opts Options) *IO {
	port := opts.Port
	if port == "" {
		port = "8081"
	}
	endpoint := opts.Endpoint
	if endpoint == "" {
		endpoint = "/socket.io"
	}

	config := socket.DefaultServerOptions()
	config.SetPingInterval(300 * time.Millisecond)
	config.SetPingTimeout(200 * time.Millisecond)
	config.SetMaxHttpBufferSize(1000000)
	config.SetConnectTimeout(1000 * time.Millisecond)
	config.SetCors(&types.Cors{
		Origin:      "*",
		Credentials: true,
	})

	sc := socket.NewServer(nil, config)

	mux := http.NewServeMux()
	mux.Handle(endpoint+"/", corsMiddleware(sc.ServeHandler(nil)))

	return &IO{
		socket: sc,
		ns:     make(map[string]*NS),
		srv: &http.Server{
			Addr:    ":" + port,
			Handler: mux,
		},
	}
}

func (io *IO) Listen() error {
	return io.srv.ListenAndServe()
}

func (io *IO) Shutdown(ctx context.Context) error {
	return io.srv.Shutdown(ctx)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (io *IO) NewSpace(name string, middleware types.EventListener) *NS {
	of := io.socket.Of(name, middleware)
	ns := newNS(io, of)

	if _, ok := io.ns[name]; ok {
		panic("duplicate namespace: " + name)
	}
	io.ns[name] = ns
	return ns
}

func (io *IO) GetSpace(name string) (*NS, bool) {
	ns, ok := io.ns[name]
	return ns, ok
}

// ================================ NameSpace ================================

type NS struct {
	Space        socket.Namespace
	useRoom      bool
	hub          *IO
	auth         socket.NamespaceMiddleware
	onConnect    func(n *NS, client *socket.Socket)
	onDisconnect func(n *NS, client *socket.Socket)
	onEvent      map[string]func(n *NS, client *socket.Socket, msg ...any)
}

type NSInitiate func(name string, md types.EventListener) *NS

func newNS(hub *IO, ns socket.Namespace) *NS {
	return &NS{
		Space:   ns,
		hub:     hub,
		onEvent: make(map[string]func(n *NS, client *socket.Socket, msg ...any)),
	}
}

type NSListener func(io *NS, client *socket.Socket)

type MessagePayload interface {
	From(msg ...any)
}
type NSListenerMessage[T MessagePayload] func(io *NS, client *socket.Socket, msg T)

func (n *NS) UserRoom() *NS {
	n.useRoom = true
	return n
}

func (n *NS) Disconnect(md NSListener) *NS {
	n.onDisconnect = func(ns *NS, client *socket.Socket) {
		md(ns, client)
	}
	return n
}

func (n *NS) Connect(mds NSListener) *NS {
	n.onConnect = func(ns *NS, client *socket.Socket) {
		mds(ns, client)
	}
	return n
}

func (n *NS) Auth(mds socket.NamespaceMiddleware) *NS {
	n.auth = func(s *socket.Socket, f func(*socket.ExtendedError)) {
		mds(s, f)
	}
	return n
}

func (n *NS) Event(evname string, p MessagePayload, md NSListenerMessage[MessagePayload]) *NS {
	payloadType := reflect.TypeOf(p)
	n.onEvent[evname] = func(ns *NS, client *socket.Socket, msg ...any) {
		payload := p
		if payloadType.Kind() == reflect.Pointer {
			payload = reflect.New(payloadType.Elem()).Interface().(MessagePayload)
		}

		payload.From(msg...)
		md(ns, client, payload)
	}
	return n
}

func (n *NS) Build() {
	if n.auth != nil {
		n.Space.Use(n.auth)
	}
	n.Space.On("connection", func(a ...any) {
		client := a[0].(*socket.Socket)
		query := client.Handshake().Query

		if n.useRoom {
			roomId := strings.TrimSpace(query.Query().Get("roomId"))
			if roomId != "" {
				client.Join(socket.Room(roomId))
			}

			if n.onConnect != nil {
				n.onConnect(n, client)
			}

			for name, ev := range n.onEvent {
				client.On(name, func(msg ...any) {
					ev(n, client, msg...)
				})
			}
			client.On("disconnect", func(any ...any) {
				if n.onDisconnect != nil {
					n.onDisconnect(n, client)
				}
			})
			return
		}

		if n.onConnect != nil {
			n.onConnect(n, client)
		}
		for name, ev := range n.onEvent {
			client.On(name, func(msg ...any) {
				ev(n, client, msg...)
			})
		}
		client.On("disconnect", func(any ...any) {
			if n.onDisconnect != nil {
				n.onDisconnect(n, client)
			}
		})

	})
}
