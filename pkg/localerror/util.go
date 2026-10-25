package localerror

import (
	"errors"

	"github.com/rdhmuhammad/apitester/pkg/logger"
)

type InvalidDataError struct {
	Msg             string
	DataToTemplated map[string]string
}

func (e InvalidDataError) Error() string {
	return e.Msg
}

func IsNotFound(err error) bool {
	return errors.Is(err, InvalidDataError{Msg: err.Error()})
}

func IsInvalidData(err error) bool {
	return err != nil && errors.As(err, &InvalidDataError{})
}

func InvalidData(msg string) error {
	return InvalidDataError{Msg: msg}
}

type InternalError struct {
	Msg string
}

func (receiver InternalError) Error() string {
	return receiver.Msg
}

type HandleError struct {
	logger logger.Logger
}

func NewHandlerError(lg logger.Logger) HandleError {
	return HandleError{
		logger: lg,
	}
}

func (h HandleError) ErrorReturn(err error) error {
	if IsNotFound(err) || IsInvalidData(err) {
		return err
	}

	h.logger.Error(err)
	return InternalError{err.Error()}
}
