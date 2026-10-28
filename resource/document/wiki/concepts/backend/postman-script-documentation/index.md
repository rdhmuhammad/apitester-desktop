# Postman Script Documentation

**Summary**: Knowledge base index for Postman scripting, runtime sandbox APIs (`pm.request`, `pm.response`), and Postman Collection SDK core classes (`Url`, `RequestAuth`, `HeaderList`, `RequestBody`).
**Sources**: `https://www.postmanlabs.com/postman-collection/index.html`, `https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-request`, `https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-response`, `https://www.postmanlabs.com/postman-collection/Url.html`, `https://www.postmanlabs.com/postman-collection/RequestAuth.html`, `https://www.postmanlabs.com/postman-collection/HeaderList.html`, `https://www.postmanlabs.com/postman-collection/RequestBody.html`
**Last updated**: 2026-10-28

---

## Overview

Postman provides two complementary JavaScript layers for working with API requests and collections:
1. **Postman Sandbox Runtime (`pm.*`)**: The execution context provided to Pre-request scripts and Post-response (Test) scripts, exposing the active request (`pm.request`) and received response (`pm.response`).
2. **Postman Collection SDK**: The underlying Node.js module (`postman-collection`) that defines the object model, serialization schemas, and helper classes representing requests, URLs, headers, bodies, and auth configurations.

This documentation section captures specifications, method references, parameter definitions, and code examples for both environments.

---

## Documentation Pages

### SDK Overview & Foundation
- [[concepts/backend/postman-script-documentation/postman-collection-sdk]] - Architecture of the Postman Collection SDK, installation, collection lifecycle, schema version compatibility (v1.0, v2.0, v2.1), and JSON serialization.

### Sandbox Runtime APIs
- [[concepts/backend/postman-script-documentation/pm-request]] - Sandbox `pm.request` object reference, script lifecycle hooks (Pre-request, Post-response), header mutations (`add`, `remove`, `upsert`), HTTP/gRPC/GraphQL request properties, and code examples.
- [[concepts/backend/postman-script-documentation/pm-response]] - Sandbox `pm.response` object reference, status codes, headers, response parsing (`.text()`, `.json()`), execution timings, and Ajv JSON Schema validation assertions.

### Core Collection SDK Classes
- [[concepts/backend/postman-script-documentation/class-url]] - Postman `Url` class specification, parsing, query parameter management (`addQueryParams`, `removeQueryParams`), protocol/host/path resolution, and stringification.
- [[concepts/backend/postman-script-documentation/class-request-auth]] - Postman `RequestAuth` class specification, authentication mechanisms, parameter stores (`VariableList`), and mutation methods (`use`, `update`, `clear`).
- [[concepts/backend/postman-script-documentation/class-header-list]] - Postman `HeaderList` collection class specification, header insertion, upserting, filtering, parent traversal, case sensitivity, and dictionary serialization (`toObject`).
- [[concepts/backend/postman-script-documentation/class-request-body]] - Postman `RequestBody` class specification, payload modes (`raw`, `urlencoded`, `formdata`, `file`, `graphql`), options, emptiness checks, and serialization.

---

## Related pages

- [[concepts/backend/postman-prerequest-script-dto]]
- [[concepts/index]]
- [[index]]
