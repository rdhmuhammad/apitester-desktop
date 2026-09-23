//go:build windows

package elog

import (
	"golang.org/x/sys/windows/svc/eventlog"
)

type winEventLogger struct {
	elog *eventlog.Log
}

func openPlatformLogger(source string) (Logger, error) {
	el, err := eventlog.Open(source)
	if err != nil {
		return nil, err
	}
	return &winEventLogger{elog: el}, nil
}

func (w *winEventLogger) Info(eid uint32, msg string) error {
	if w.elog == nil {
		return nil
	}
	return w.elog.Info(eid, msg)
}

func (w *winEventLogger) Warning(eid uint32, msg string) error {
	if w.elog == nil {
		return nil
	}
	return w.elog.Warning(eid, msg)
}

func (w *winEventLogger) Error(eid uint32, msg string) error {
	if w.elog == nil {
		return nil
	}
	return w.elog.Error(eid, msg)
}

func (w *winEventLogger) Close() error {
	if w.elog != nil {
		return w.elog.Close()
	}
	return nil
}
