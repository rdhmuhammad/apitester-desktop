# Class: Url

**Summary**: Specification and API reference for the Postman Collection SDK `Url` class, encapsulating URL decomposition, segment parsing, path variable bindings, and query parameter management.
**Sources**: `https://www.postmanlabs.com/postman-collection/Url.html`
**Last updated**: 2026-10-28

---

## Overview

The `Url` class (extending `Property`) represents a uniform resource locator in the Postman Collection SDK. Rather than storing a URL as a plain string, it decomposes the address into structured, manipulable components: protocol, host segments, port, path segments, query parameters, hash fragments, and path variables.

### Inheritance
- Extends: `Property` (from `postman-collection`)

---

## Constructor

### `new Url(options)`
Creates a new `Url` instance from a string or structured options object.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `options` | `Object` \| `String` | **Yes** | A full URL string (e.g., `"https://api.example.com:8080/v1/users?limit=10"`) or a configuration object with URL properties (`protocol`, `host`, `path`, `query`, etc.). |

```javascript
const { Url } = require('postman-collection');

// From string
const url1 = new Url("https://api.example.com/v1/users?status=active");

// From structured object
const url2 = new Url({
  protocol: "https",
  host: ["api", "example", "com"],
  path: ["v1", "users", ":id"],
  query: [{ key: "sort", value: "desc" }],
  variable: [{ key: "id", value: "123" }]
});
```

---

## Member Properties

| Member | Type | Description |
| :--- | :--- | :--- |
| `protocol` | `String` | Protocol scheme without trailing `:` (e.g., `"https"`, `"http"`). |
| `host` | `Array<String>` | Array of subdomain, domain, and TLD strings (e.g., `["api", "example", "com"]`). |
| `port` | `String` | Port number as a string (e.g., `"8080"`, `"3000"`). Empty if default for protocol. |
| `path` | `Array<String>` | Array of path segment strings (e.g., `["v1", "users", ":id"]`). |
| `query` | `PropertyList<QueryParam>` | Collection of query parameters with `.add()`, `.remove()`, and `.all()` helpers. |
| `hash` | `String` | URL fragment identifier without leading `#`. |
| `auth` | `Object` | Userinfo credentials (`user`, `password`) if included inline in the URL. |
| `variables` | `VariableList` | Path variables mapped to segments prefixed with `:` (e.g., `:id`). |

---

## Static Methods

### `Url.isUrl(obj) -> Boolean`
Checks whether the provided object is an instance of `Url`.
```javascript
Url.isUrl(new Url("https://example.com")); // true
Url.isUrl("https://example.com"); // false
```

### `Url.parse(url) -> Object`
Parses a URL string into its constituent component parts without creating a full class instance.
```javascript
const parsed = Url.parse("https://user:pass@api.example.com:8443/v1/test?q=postman#section");
// Returns: { protocol: 'https', auth: { user: 'user', password: 'pass' }, host: ['api', 'example', 'com'], port: '8443', path: ['v1', 'test'], query: [...], hash: 'section' }
```

---

## Instance Methods

### Query Parameter Manipulation

#### `addQueryParams(params)`
Appends query parameters to the URL.
- **Parameters**: `params` (`Object` | `String`): An object of key-value pairs or a query string.
```javascript
url.addQueryParams({ page: "2", limit: "50" });
url.addQueryParams("filter=verified");
```

#### `removeQueryParams(params)`
Removes query parameters matching the provided criteria.
- **Parameters**: `params` (`Array<QueryParam>` | `Array<String>` | `String`): A parameter key string or array of keys.
```javascript
url.removeQueryParams(["page", "limit"]);
```

#### `getQueryString() -> String`
Serializes and returns the formatted query string (e.g., `"page=2&limit=50"`).

---

### Path & Host Resolution

#### `getHost() -> String`
Reconstitutes the host array into a domain string (e.g., `"api.example.com"`).

#### `getPath(unresolved, nullable) -> String`
Returns the normalized path with a leading slash (e.g., `"/v1/users"`).
- **Parameters**: `unresolved` (`Boolean`, optional): If `true`, leaves path variables unresolved in template form.

#### `getPathWithQuery() -> String`
Returns the complete path including the serialized query string (e.g., `"/v1/users?page=1"`).

#### `getRemote(forcePort, nullable) -> String`
Returns the host and port separated by `:`, omitting default ports (80 for http, 443 for https) unless `forcePort: true`.
```javascript
url.getRemote(); // "api.example.com"
url.getRemote(true); // "api.example.com:443"
```

---

### Mutation & Serialization

#### `update(url)`
Replaces the URL components from a new URL string or configuration object.
```javascript
url.update("https://staging.api.com/v2/items");
```

#### `toString(forceProtocol) -> String`
Serializes the `Url` instance back into a full URL string.
- **Parameters**: `forceProtocol` (`Boolean`, optional): Ensures a protocol scheme is prefixed even if omitted originally.

#### `toJSON() -> Object`
Serializes the URL into Postman Collection JSON schema format:
```json
{
  "raw": "https://api.example.com/v1/users?page=1",
  "protocol": "https",
  "host": ["api", "example", "com"],
  "path": ["v1", "users"],
  "query": [
    { "key": "page", "value": "1" }
  ]
}
```

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-request]]
- [[concepts/base-url-lifecycle]]
- [[concepts/path-variable-lifecycle]]
- [[index]]
