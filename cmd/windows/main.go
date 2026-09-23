package main

import (
	"context"
	"flag"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/automation"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/collection"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/environment"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/restrequest"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/testsuits"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/tree"
	requestSocket "github.com/rdhmuhammad/apitester/internal/adapter/socket/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/shared/api"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
)

type WinService struct {
	api *api.Api
}

func (w *WinService) Execute(args []string, r <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown | svc.AcceptPauseAndContinue

	status <- svc.Status{State: svc.StartPending}
	elog.Info(elog.EIDSuccess, "Service worker initializing API server...")

	w.api = api.Default()
	w.api.Register(func(conn api.Conns) []api.Router {
		return []api.Router{
			collection.NewController(conn.Logger, conn.DB),
			tree.NewController(conn.Logger, conn.DB),
			restrequest.NewController(conn.Logger, conn.DB),
			environment.NewController(conn.Logger, conn.DB),
			testsuits.NewController(conn.Logger, conn.DB),
			automation.NewController(conn.Logger, conn.DB),
		}
	})
	w.api.RegisterSocket(func(conn api.Conns) []api.Namespace {
		return []api.Namespace{
			requestSocket.NewRestRequestSocket(conn.Logger, conn.DB),
		}
	})

	g, gctx := errgroup.WithContext(context.Background())
	g.Go(func() error {
		return w.api.Start()
	})

	status <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}
	elog.Infof(elog.EIDSuccess, "Service started, HTTP on port %s", os.Getenv("APP_PORT"))

loop:
	for {
		select {
		case <-gctx.Done():
			break loop
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				status <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				elog.Info(elog.EIDServiceNotStarted, "Service received stop/shutdown request")
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if err := w.api.Shutdown(ctx); err != nil {
					elog.Errorf(elog.EIDGenericError, "API shutdown error: %v", err)
				}
				break loop
			case svc.Pause:
				status <- svc.Status{State: svc.Paused, Accepts: cmdsAccepted}
				elog.Info(elog.EIDSuccess, "Service paused")
			case svc.Continue:
				status <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}
				elog.Info(elog.EIDSuccess, "Service continued")
			default:
				elog.Warningf(elog.EIDInvalidParameter, "Unexpected service control request #%d", c.Cmd)
			}
		}
	}

	status <- svc.Status{State: svc.StopPending}

	exitCode := uint32(0)
	if err := g.Wait(); err != nil {
		elog.Errorf(elog.EIDGenericError, "API server stopped unexpectedly: %v", err)
		exitCode = 1
	} else {
		elog.Info(elog.EIDServiceNotStarted, "Service stopped gracefully")
	}

	return false, exitCode
}

func runService(name string, isDebug bool) {
	svcInst := &WinService{}
	if isDebug {
		elog.Infof(elog.EIDSuccess, "Starting service '%s' in debug/console mode", name)
		err := debug.Run(name, svcInst)
		if err != nil {
			elog.Errorf(elog.EIDGenericError, "Error running service in debug mode: %v", err)
		}
	} else {
		elog.Infof(elog.EIDSuccess, "Starting service '%s' in Service Control Manager mode", name)
		err := svc.Run(name, svcInst)
		if err != nil {
			elog.Errorf(elog.EIDGenericError, "Error running service in Service Control mode: %v", err)
		}
	}
}

func getLogPath() string {
	if p := os.Getenv("LOG_PATH"); p != "" {
		return p
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "resource/log/debug.log"
	}

	return filepath.Join(configDir, "apitester", "debug.log")
}

func setupFileLogging(isDebug bool) *os.File {
	if isDebug {
		return nil
	}
	logPath := getLogPath()
	if err := os.MkdirAll(filepath.Dir(logPath), 0755); err != nil {
		log.SetOutput(io.Discard)
		return nil
	}

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		log.SetOutput(f)
		os.Stdout = f
		os.Stderr = f
		gin.DefaultWriter = f
		gin.DefaultErrorWriter = f
		gin.SetMode(gin.ReleaseMode)
		return f
	}

	log.SetOutput(io.Discard)
	return nil
}

func main() {
	var envFile string
	var isDebug bool
	flag.StringVar(&envFile, "env", ".env.stag", "Provide env file path")
	flag.BoolVar(&isDebug, "debug", false, "Run in debug/console mode")
	flag.Parse()

	// 1. In Windows service mode, prevent "The handle is invalid" on stdout/stderr
	if !isDebug {
		log.SetOutput(io.Discard)
	}

	// 2. Open Windows Event Log globally
	if err := elog.Init("Apitester-backend"); err != nil {
		log.Printf("elog.Init failed: %v (service may not be installed)", err)
	} else {
		defer elog.Close()
	}

	elog.Info(elog.EIDSuccess, "Apitester backend service initializing...")

	// 3. Load environment file
	err := godotenv.Load(envFile)
	if err != nil {
		elog.Panicf(elog.EIDFileNotFound, "Failed to load env file '%s': %v", envFile, err)
		return
	}
	elog.Infof(elog.EIDSuccess, "Loaded environment configuration from '%s'", envFile)

	// 4. Safely set up file logging (redirecting stdout/stderr and Gin writers)
	logFile := setupFileLogging(isDebug)
	if logFile != nil {
		defer logFile.Close()
		elog.Infof(elog.EIDSuccess, "Log file opened: %s", getLogPath())
	} else if !isDebug {
		elog.Warningf(elog.EIDAccessDenied, "Failed to open log file %s, logging only to Windows Event Log", getLogPath())
	}

	// 5. Run service
	runService("Apitester-backend", isDebug)
}
