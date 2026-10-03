package mapper

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	payload "github.com/rdhmuhammad/apitester/shared/payload"
)

func (m Mapper) NewResponse(c *gin.Context, res *payload.Response, err error) {
	if err != nil {
		fmt.Printf("ERROR: %s \n", err.Error())
		c.JSON(
			http.StatusInternalServerError,
			payload.DefaultErrorResponseWithMessage(err.Error(), err),
		)
		return
	}
	if res != nil {
		res.Message = "Success"
		c.JSON(http.StatusOK, res)
		return
	}

	c.Status(http.StatusOK)
}

func (m Mapper) IsInvalidDataError(err error) (bool, localerror.InvalidDataError) {
	var invalidDataError localerror.InvalidDataError
	if errors.As(err, &invalidDataError) {
		return true, invalidDataError
	}
	return false, invalidDataError
}
