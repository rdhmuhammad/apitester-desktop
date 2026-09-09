# Socket Base Composition

**Summary**: Socket modules embed a shared base socket to reuse cross-cutting runtime dependencies while keeping feature-specific state on the module struct.
**Sources**: `resource/document/raw/patterns/backend/Example of Module Socket.md`
**Last updated**: 2026-09-08

---

## Pattern

The example embeds `base.BaseSocket` in `ChatSocket` and adds only the cached chat usecase. This lets handlers use shared environment configuration, security, error handling, and socket mapping without duplicating those fields.

```go
type ChatSocket struct {
	base.BaseSocket
	cachedUc controller.CachedChatUsecase
}
```

The constructor receives a ready base socket and assigns it alongside the feature usecase. Keep constructors explicit about infrastructure dependencies so wiring remains visible at the composition layer. When the feature usecase uses `db.RepositoryInterface`, pass `*bbolt.DB` to the usecase constructor and create each typed repository with `db.NewRepository` there. Do not centralize repository creation in `shared/api/default.go` through an `initRepositories` helper.

## Related pages

- [[patterns/socket/example-of-module-socket]]
- [[patterns/socket/socket-error-handling]]
