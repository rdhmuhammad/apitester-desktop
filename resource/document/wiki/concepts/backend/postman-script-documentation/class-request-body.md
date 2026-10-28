# Class: RequestBody

**Summary**: Specification and API reference for the Postman Collection SDK `RequestBody` class, encapsulating HTTP payload modes (`raw`, `formdata`, `urlencoded`, `file`, `graphql`), formatting options, and serialization.
**Sources**: `https://www.postmanlabs.com/postman-collection/RequestBody.html`
**Last updated**: 2026-10-28

---

## Overview

The `RequestBody` class represents the payload sent in an HTTP request. It supports multiple encoding formats (`raw`, `urlencoded`, `formdata`, `file`, and `graphql`) and encapsulates language presentation hints (e.g., JSON, XML, plain text) via its `options` property.

### Inheritance
- Extends: `Property` (from `postman-collection`)

---

## Constructor

### `new RequestBody(options)`
Creates a new `RequestBody` instance configured with the specified mode and data.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `options` | `Object` | **Yes** | Initial body definition conforming to Postman Collection Schema v2.1.0. |

```javascript
const { RequestBody } = require('postman-collection');

// Raw JSON Body
const jsonBody = new RequestBody({
  mode: "raw",
  raw: JSON.stringify({ name: "Alice", role: "developer" }),
  options: {
    raw: { language: "json" }
  }
});

// URL-encoded Body
const urlencodedBody = new RequestBody({
  mode: "urlencoded",
  urlencoded: [
    { key: "username", value: "alice" },
    { key: "grant_type", value: "password" }
  ]
});
```

---

## Member Properties

| Member | Type | Description |
| :--- | :--- | :--- |
| `mode` | `String` | Active payload mode. Allowed values: `"raw"`, `"urlencoded"`, `"formdata"`, `"file"`, `"graphql"`. |
| `raw` | `String` | String content used when `mode === "raw"`. |
| `urlencoded` | `PropertyList<QueryParam>` | Form-encoded parameters used when `mode === "urlencoded"`. |
| `formdata` | `PropertyList<FormParam>` | Multipart form-data entries used when `mode === "formdata"`. |
| `file` | `Object` | File reference (file path for Node.js, file ID in browser) when `mode === "file"`. |
| `graphql` | `Object` | Object containing `query: String` and `variables: String` when `mode === "graphql"`. |
| `options` | `Object` | Presentation metadata and language hints (e.g., `{ raw: { language: "json" } }`). |
| `disabled` | `Boolean` | When `true`, excludes the body from the outgoing HTTP request. |

### Static Constants

- **`RequestBody.MODES`** (`Object`): Enumeration of recognized body modes (`raw`, `urlencoded`, `formdata`, `file`, `graphql`).

---

## Instance Methods

### Mutation & Inspection

#### `update(options)`
Updates the mode and contents of the request body.
- **Parameters**: `options` (`Object`): Partial or complete body definition.

```javascript
body.update({
  mode: "raw",
  raw: '{"updated": true}',
  options: { raw: { language: "json" } }
});
```

#### `isEmpty() -> Boolean`
Checks whether the body contains no payload data for its configured mode.

```javascript
body.isEmpty(); // false
```

#### `toString() -> String`
Stringifies the payload based on the active mode:
- For `"raw"`, returns the raw string.
- For `"urlencoded"`, serializes key-value pairs as a query string (e.g., `"grant_type=password&username=alice"`).
- For `"graphql"`, serializes the GraphQL query and variables.

---

## Serialization & JSON Schema

#### `toJSON() -> Object`
Serializes the `RequestBody` instance into the canonical Postman Collection v2.1.0 JSON format:

```json
{
  "mode": "raw",
  "raw": "{\n  \"action\": \"sync\"\n}",
  "options": {
    "raw": {
      "language": "json"
    }
  }
}
```

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-request]]
- [[concepts/backend/postman-script-documentation/class-header-list]]
- [[concepts/backend/postman-prerequest-script-dto]]
- [[index]]
