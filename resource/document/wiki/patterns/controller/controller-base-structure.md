# Controller Base Structure

**Summary**: Feature controllers embed a shared base controller and expose a narrow usecase interface, keeping transport handlers decoupled from concrete usecase implementations.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Controller.md`
**Last updated**: 2026-09-08

---

## Pattern

New controller files belong in `internal/adapter/controller/<module>`. The controller is an adapter, so it should translate HTTP or socket input into usecase calls rather than contain business logic.

The example uses `base.BaseController` for shared binding, mapping, security, and idempotency facilities. Its `BookingUsecase` interface lists only the operations called by the controller.

This boundary makes handlers easier to test and prevents them from depending on unrelated usecase methods. The constructor is the composition point where database, external storage, ports, and the shared base controller are assembled. For usecases that depend on `db.RepositoryInterface`, the controller should pass `*bbolt.DB`; the usecase creates each typed repository with `db.NewRepository` rather than receiving repositories from a global `initRepositories` function.

## Related pages

- [[patterns/controller/example-of-module-controller]]
- [[patterns/usecase/new-usecase-workflow]]
