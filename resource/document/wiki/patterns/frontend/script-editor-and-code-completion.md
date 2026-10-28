# Script Editor and Code Completion Architecture

**Summary**: Layered architecture for the Sandpack/CodeMirror script editor, separating static completion schemas and theme tokens (`types`), completion and diagnostic hooks (`hooks`), the global editor (`components/ui`), and page-specific components.
**Sources**: `frontend/src/types/codeEditor.ts`, `frontend/src/types/scriptCompletionSchemas.ts`, `frontend/src/hooks/useCodeCompletions.ts`, `frontend/src/hooks/useCodeDiagnostic.ts`, `frontend/src/hooks/useSandpackEditor.ts`, `frontend/src/components/ui/sandpack-script-editor.tsx`, `frontend/src/pages/editor/components/RequestConfig/ScriptEditor.tsx`, `frontend/src/layout/components/collectionManager/ScriptManage.tsx`, `frontend/src/pages/editor/components/RequestConfig/BodyEditor.tsx`
**Last updated**: 2026-10-28

---

## Layered Dependency Rules

The frontend editor workflow follows a strict unidirectional dependency graph:

1. **`types` (`src/types/codeEditor.ts`, `src/types/scriptCompletionSchemas.ts`)**:
   - Pure static DTO definitions (`CompletionNode`, `CompletionNamespaceSchema`, `SandpackScriptEditorProps`), editor theme palettes (`DARK_EDITOR_PALETTE`, `LIGHT_EDITOR_PALETTE`), and static completion trees (`PM_NAMESPACE_SCHEMA`, `REQUEST_NAMESPACE_SCHEMA`, `RESPONSE_NAMESPACE_SCHEMA`, `CRYPTO_JS_NAMESPACE_SCHEMA`, `JS_MEMBER_COMPLETIONS`).
   - Contains zero runtime logic.
2. **`hooks` (`src/hooks/useCodeCompletions.ts`, `src/hooks/useCodeDiagnostic.ts`, `src/hooks/useSandpackEditor.ts`)**:
   - `useCodeCompletions`: Provides a single generic tree-walking completion factory (`createNamespaceCompletionSource`) supporting arbitrary dot-chain depth (`pm.request.url.raw`), array index access (`request.headers[0].key`), invocation chains (`pm.expect(...).to.be`), and CodeMirror `snippetCompletion` placeholders (`${1}`). Dynamically excludes registered namespace roots from generic JavaScript member completions (`createJsCompletionSource`).
   - `useCodeDiagnostic`: Provides syntax validation (`getJavaScriptDiagnostic`, `getJsonDiagnostic`) and a memoized CodeMirror `linter` extension.
   - `useSandpackEditor`: Encapsulates Sandpack file synchronization with echo suppression (`useSandpackFileSync`) and CodeMirror extension composition (`useSandpackEditorExtensions`).
3. **`ui component` (`src/components/ui/sandpack-script-editor.tsx`)**:
   - Domain-agnostic, reusable `<SandpackScriptEditor />` component accepting unified `completionSources`, `extensions`, and optional `diagnostic` props.
4. **`component` (`ScriptEditor.tsx`, `ScriptManage.tsx`, `BodyEditor.tsx`, `ResponseView.tsx`)**:
   - Page-specific components that wire feature hooks (`useCodeCompletions`, `useCodeDiagnostic`, `useRequestConfig`, `useCollection`) into `<SandpackScriptEditor />`.
5. **`page index` (`src/pages/editor/index.tsx`, `RequestConfig/index.tsx`)**:
   - Coordinates active tabs and request configuration state across page-specific components.

## Extending Code Completion

To add a new global autocomplete namespace (for example, a new sandbox helper library):
1. Define a static `CompletionNamespaceSchema` object in `src/types/scriptCompletionSchemas.ts`.
2. Add the schema to `PRE_REQUEST_COMPLETION_SCHEMAS`, `POST_REQUEST_COMPLETION_SCHEMAS`, or pass a custom `CompletionNamespaceSchema[]` array directly to `useCodeCompletions(schemas)`.

No changes to `createNamespaceCompletionSource`, `createJsCompletionSource`, or `SandpackScriptEditor` are required.

## Related pages

- [[patterns/frontend/index]]
- [[patterns/frontend/api-service-and-query-hook-wiring]]
- [[concepts/backend/postman-prerequest-script-dto]]
- [[concepts/backend/postman-script-documentation/index]]
