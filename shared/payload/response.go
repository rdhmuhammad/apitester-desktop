package payload

type ResponseMeta struct {
	Success      bool   `json:"success"`
	MessageTitle string `json:"messageTitle"`
	Message      string `json:"message"`
	ErrorServer  string `json:"errorServer"`
}

type ErrorResponse struct {
	ResponseMeta
	Data   any `json:"data"`
	Errors any `json:"errors,omitempty"`
}

func DefaultErrorResponseWithMessage(msg string, err error) *ErrorResponse {
	return &ErrorResponse{
		ResponseMeta: ResponseMeta{
			Success:      false,
			MessageTitle: "Oops, something went wrong.",
			Message:      msg,
			ErrorServer:  err.Error(),
		},
		Data: nil,
	}
}

func DefaultErrorInvalidDataWithMessage(msg string) *ErrorResponse {
	return &ErrorResponse{
		ResponseMeta: ResponseMeta{
			Success:      false,
			MessageTitle: "Invalid data.",
			Message:      msg,
		},
	}
}

type Response struct {
	ResponseMeta
	Data any `json:"data"`
}

func NewSuccessResponseNoMsg(data any) *Response {
	return &Response{
		ResponseMeta: ResponseMeta{
			Success:      true,
			MessageTitle: "Success",
		},
		Data: data,
	}
}

func NewSuccessResponseNoData(msg string) *Response {
	return &Response{
		ResponseMeta: ResponseMeta{
			Success:      true,
			Message:      msg,
			MessageTitle: "Success",
		},
	}
}

func NewSuccessResponse(data any, msg string) *Response {
	return &Response{
		ResponseMeta: ResponseMeta{
			Success:      true,
			Message:      msg,
			MessageTitle: "Success",
		},
		Data: data,
	}
}
