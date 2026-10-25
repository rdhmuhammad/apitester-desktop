//go:build windows

package elog

import (
	"golang.org/x/sys/windows/svc/eventlog"
)

func openPlatformLogger(source string) (Logger, error) {
	return eventlog.Open(source)
}
