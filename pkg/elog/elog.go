package elog

import (
	"fmt"
	"log"
	"runtime/debug"
	"sync"
)

const (
	// Windows System Error Code Event IDs mapped for eventlog
	EIDSuccess           uint32 = 0    // Normal startup, status updates, or standard informational logs
	EIDGenericError      uint32 = 1    // Generic fallback error (Incorrect function)
	EIDFileNotFound      uint32 = 2    // Failed to load a configuration file, missing binary, or bad paths
	EIDPathNotFound      uint32 = 3    // Network share, folder path, or working directory missing
	EIDAccessDenied      uint32 = 5    // Permission issues
	EIDHandleInvalid     uint32 = 6    // The handle is invalid (avoid unless tracking invalid handles)
	EIDOutOfMemory       uint32 = 8    // Out-of-memory errors
	EIDDiskFull          uint32 = 14   // Disk space completely full
	EIDDeviceNotReady    uint32 = 21   // Device not ready
	EIDFileLockConflict  uint32 = 32   // File locking conflicts
	EIDNetworkPathNoFind uint32 = 53   // Remote API endpoint offline or network path not found
	EIDInvalidParameter  uint32 = 87   // Invalid CLI flags or control requests
	EIDServiceNotStarted uint32 = 1062 // Graceful internal shutdown or service stopped
)

// Logger defines the interface for event logging.
type Logger interface {
	Info(eid uint32, msg string) error
	Warning(eid uint32, msg string) error
	Error(eid uint32, msg string) error
	Close() error
}

var (
	mu            sync.RWMutex
	defaultLogger Logger
	onceInit      sync.Once
)

// Init initializes the global event logger with the specified source name.
func Init(source string) error {
	mu.Lock()
	defer mu.Unlock()
	if defaultLogger != nil {
		_ = defaultLogger.Close()
	}
	l, err := openPlatformLogger(source)
	if err != nil {
		return err
	}
	defaultLogger = l
	return nil
}

// SetLogger overrides the global event logger with a custom implementation.
func SetLogger(l Logger) {
	mu.Lock()
	defer mu.Unlock()
	defaultLogger = l
}

// Close closes the global event logger.
func Close() error {
	mu.Lock()
	defer mu.Unlock()
	if defaultLogger != nil {
		err := defaultLogger.Close()
		defaultLogger = nil
		return err
	}
	return nil
}

func getLogger() Logger {
	mu.RLock()
	l := defaultLogger
	mu.RUnlock()
	if l != nil {
		return l
	}

	onceInit.Do(func() {
		// Attempt lazy default initialization with standard application source
		if el, err := openPlatformLogger("Apitester-backend"); err == nil {
			mu.Lock()
			defaultLogger = el
			mu.Unlock()
			l = el
		}
	})
	return l
}

// Info logs an informational string message with the given Event ID.
func Info(eid uint32, msg string) {
	if l := getLogger(); l != nil {
		_ = l.Info(eid, msg)
	}
	log.Printf("[INFO] (EID %d): %s", eid, msg)
}

// Infof logs a formatted informational message with the given Event ID.
func Infof(eid uint32, format string, args ...any) {
	Info(eid, fmt.Sprintf(format, args...))
}

// Warning logs a warning string message with the given Event ID.
func Warning(eid uint32, msg string) {
	if l := getLogger(); l != nil {
		_ = l.Warning(eid, msg)
	}
	log.Printf("[WARNING] (EID %d): %s", eid, msg)
}

// Warningf logs a formatted warning message with the given Event ID.
func Warningf(eid uint32, format string, args ...any) {
	Warning(eid, fmt.Sprintf(format, args...))
}

// Error logs an error string message with the given Event ID.
func Error(eid uint32, msg string) {
	if l := getLogger(); l != nil {
		_ = l.Error(eid, msg)
	}
	log.Printf("[ERROR] (EID %d): %s", eid, msg)
}

// Errorf logs a formatted error message with the given Event ID.
func Errorf(eid uint32, format string, args ...any) {
	Error(eid, fmt.Sprintf(format, args...))
}

// Panic logs the error with EIDGenericError and full stack trace to eventlog, then panics.
func Panic(err error) {
	if err == nil {
		return
	}
	msg := fmt.Sprintf("%v\n\nStack trace:\n%s", err, debug.Stack())
	Error(EIDGenericError, "PANIC: "+msg)
	panic(err)
}

// PanicWithID logs the error with a specific Event ID and full stack trace to eventlog, then panics.
func PanicWithID(eid uint32, err error) {
	if err == nil {
		return
	}
	msg := fmt.Sprintf("%v\n\nStack trace:\n%s", err, debug.Stack())
	Error(eid, "PANIC: "+msg)
	panic(err)
}

// Panicf logs a formatted message with a specific Event ID and full stack trace to eventlog, then panics.
func Panicf(eid uint32, format string, args ...any) {
	formatted := fmt.Sprintf(format, args...)
	msg := fmt.Sprintf("%s\n\nStack trace:\n%s", formatted, debug.Stack())
	Error(eid, "PANIC: "+msg)
	panic(formatted)
}

// Recover handles a panic by logging it to eventlog with the given Event ID.
func Recover(eid uint32, contextMsg string) {
	if r := recover(); r != nil {
		msg := fmt.Sprintf("%s - recovered from panic: %v\n\nStack trace:\n%s", contextMsg, r, debug.Stack())
		Error(eid, msg)
	}
}
