//go:build !windows

package elog

type dummyLogger struct{}

func openPlatformLogger(source string) (Logger, error) {
	return &dummyLogger{}, nil
}

func (d *dummyLogger) Info(eid uint32, msg string) error {
	return nil
}

func (d *dummyLogger) Warning(eid uint32, msg string) error {
	return nil
}

func (d *dummyLogger) Error(eid uint32, msg string) error {
	return nil
}

func (d *dummyLogger) Close() error {
	return nil
}
