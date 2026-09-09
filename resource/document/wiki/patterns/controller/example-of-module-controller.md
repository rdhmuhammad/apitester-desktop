# Create New Controller Module

**Summary**: A controller module coordinates HTTP transport concerns around a feature usecase. The example defines a controller and usecase interface, validates requests, maps results and errors, and exposes routes with security and idempotency middleware.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Controller.md`
**Last updated**: 2026-09-08

---

## Module structure

Always place new controller files under `internal/adapter/controller/<module>`. Keep the controller in the adapter layer and place business logic in the corresponding usecase module.

Start with a controller that embeds [[patterns/controller/controller-base-structure]] and stores the feature usecase behind a narrow interface:

```go
type BookingController struct {
	base.BaseController
	socketIO *cio.NS
	usecase  BookingUsecase
}

type BookingUsecase interface {
	UpdateStatus(ctx context.Context, request booking.UpdateStatus) (roomID string, err error)
	CreateBooking(ctx context.Context, request booking.CreateBookingRequest) error
	GetAdjustPrice(ctx context.Context, therapistCode string) (booking.AdjustPriceResponse, error)
	RescheduleBooking(ctx context.Context, request booking.RescheduleBookingRequest) (booking.RescheduleBookingResponse, error)
}
```

The constructor receives infrastructure dependencies and initializes the usecase:

```go
func NewBookingController(
	dbConn *bbolt.DB,
	mongoConn *mongodb.Conn,
	prt base.Port,
	ctrl base.BaseController,
) BookingController {
	return BookingController{
		BaseController: ctrl,
		usecase:        booking.NewUsecase(dbConn, mongoConn, prt),
	}
}
```

When the usecase depends on `db.RepositoryInterface`, pass the shared `*bbolt.DB` into the usecase constructor. The usecase constructor creates each typed repository with `db.NewRepository`; do not create a central `initRepositories` helper in `shared/api/default.go` and pass repository interfaces through the controller constructor.

## Creation workflow

1. Add the controller package and embed the shared base controller.
2. Define a usecase interface containing only methods required by HTTP handlers.
3. Add a constructor that passes the database connection and other infrastructure dependencies into the usecase. Let the usecase create its own typed repositories with `db.NewRepository` when required.
4. Implement one handler per operation using the request context.
5. Bind and validate request bodies before invoking the usecase.
6. Extract path parameters and add them to validated request objects when needed.
7. Convert usecase failures with the shared mapper and return immediately.
8. Return standardized success responses for completed operations.
9. Add a `Route` method with grouped paths and required middleware.
10. Register the controller's route group in the application's router composition.

## Handler example

The `RescheduleBooking` handler demonstrates the normal request path:

```go
func (ctrl BookingController) RescheduleBooking(c *gin.Context) {
	var request booking.RescheduleBookingRequest
	if errs := ctrl.Enigma.BindAndValidate(c, &request); len(errs) > 0 {
		c.JSON(http.StatusBadRequest, dto.DefaultInvalidInputFormResponse(errs))
		return
	}

	request.Code = c.Param("code")
	res, err := ctrl.usecase.RescheduleBooking(c.Request.Context(), request)
	ctrl.Mapper.NewResponse(c, dto.NewSuccessResponse(res, constant.RescheduleBookingSuccess), err)
}
```

See [[patterns/controller/controller-request-handling]] for validation and response rules.

## Route example

Routes are grouped by feature and middleware is attached at the endpoint that needs it:

```go
func (r BookingController) Route(routeGr *gin.RouterGroup) {
	bookingRouter := routeGr.Group("/booking")

	bookingRouter.POST("/create",
		r.Security.Validate(),
		r.Security.Authorize(constant.RoleIsUser),
		r.Idem.Idempotent("/bookingRouter/create", "username", time.Millisecond*2),
		r.CreateBooking,
	)
	bookingRouter.GET("/adjust-price/:therapistCode", r.GetAdjustPrice)
	bookingRouter.PUT("/reschedule/:code",
		r.Security.Validate(),
		r.Security.Authorize(constant.RoleIsUser),
		r.RescheduleBooking,
	)
}
```

The route layer should enforce transport-level access rules while business decisions remain in the usecase. See [[patterns/controller/controller-routing-and-middleware]].

## HTTP and socket coordination

Controllers may coordinate another transport after a successful usecase operation. In `CloseBooking`, the controller gets the affected room, emits a localized socket alert, disconnects the room sockets, and then returns the HTTP success response. This keeps the usecase focused on booking state while the controller coordinates HTTP and socket effects.

## Related pages

- [[patterns/controller/controller-base-structure]]
- [[patterns/controller/controller-request-handling]]
- [[patterns/controller/controller-routing-and-middleware]]
- [[patterns/socket/example-of-module-socket]]
- [[patterns/usecase/new-usecase-workflow]]
