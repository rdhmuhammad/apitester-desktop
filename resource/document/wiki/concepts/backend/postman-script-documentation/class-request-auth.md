# Class: RequestAuth

**Summary**: Specification and API reference for the Postman Collection SDK `RequestAuth` class, representing declarative authentication mechanisms, parameter stores, and inheritance across collections.
**Sources**: `https://www.postmanlabs.com/postman-collection/RequestAuth.html`
**Last updated**: 2026-10-28

---

## Overview

The `RequestAuth` class (extending `Property`) encapsulates authentication configurations in the Postman Collection SDK. It provides a standardized data model and helper API for managing various authentication mechanisms, including Bearer Tokens, Basic Auth, API Keys, OAuth 1.0/2.0, AWS Signature v4, Digest, NTLM, and Hawk.

Authentication defined at a parent folder or collection level can be inherited by descendant requests unless explicitly overridden.

### Inheritance
- Extends: `Property` (from `postman-collection`)

---

## Constructor

### `new RequestAuth(options, parent)`
Creates an authentication configuration instance.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `options` | `RequestAuth.definition` | **Yes** | Initial authentication definition object containing the `type` and type-specific parameter maps. |
| `parent` | `Property` \| `PropertyList` | No | Parent item or item group to enable contextual variable resolution. |

```javascript
const { RequestAuth } = require('postman-collection');

const auth = new RequestAuth({
  type: "bearer",
  bearer: [
    { key: "token", value: "{{accessToken}}", type: "string" }
  ]
});
```

---

## Member Properties

| Member | Type | Description |
| :--- | :--- | :--- |
| `type` | `String` | Selected authentication mechanism identifier (e.g., `"bearer"`, `"basic"`, `"apikey"`, `"oauth2"`). |
| `disabled` | `Boolean` | When `true`, disables authentication injection without deleting parameters. |
| `id` | `String` | Unique UUID identifying the authentication instance. |
| `name` | `String` | Human-readable name displayed in the Postman interface. |

---

## Static Methods

### `RequestAuth.isValidType(type) -> Boolean`
Validates whether a given string is a recognized authentication mechanism in the SDK.

```javascript
RequestAuth.isValidType("bearer"); // true
RequestAuth.isValidType("custom_auth"); // false
```

### Supported Authentication Types

The SDK recognizes the following standard types:
- `"apikey"`: Key and value injected via query params or headers.
- `"basic"`: HTTP Basic Auth credentials (`username`, `password`).
- `"bearer"`: Bearer token header injection.
- `"oauth1"`: OAuth 1.0 signature and tokens.
- `"oauth2"`: OAuth 2.0 access tokens and refresh configurations.
- `"awsv4"`: AWS Signature v4 parameters (`accessKey`, `secretKey`, `region`, `service`).
- `"digest"`: HTTP Digest authentication credentials.
- `"ntlm"`: Windows NTLM authentication.
- `"hawk"`: Hawk HTTP authentication scheme.

---

## Instance Methods

### Type & Parameter Configuration

#### `use(type, options)`
Selects the active authentication mechanism and replaces all existing parameters for that type.
- **Parameters**:
  - `type` (`String`): Authentication type identifier.
  - `options` (`VariableList` | `Array<Object>` | `Object`): Configuration parameters for the chosen type.

```javascript
auth.use("basic", [
  { key: "username", value: "admin" },
  { key: "password", value: "secret123" }
]);
```

#### `update(options, type)`
Updates specific parameters for an authentication type without clearing other attributes.
- **Parameters**:
  - `options` (`VariableList` | `Array<Object>` | `Object`): Parameter key-values to apply.
  - `type` (`String`, optional): Target auth type (defaults to current active type).

```javascript
auth.update([{ key: "password", value: "newPassword456" }]);
```

#### `clear(type)`
Clears parameters and resets configuration for the specified authentication type.
- **Parameters**: `type` (`String`): Target auth type.

```javascript
auth.clear("basic");
```

#### `parameters() -> VariableList`
Returns the `VariableList` representing all key-value parameters defined for the currently active authentication type.

---

## Serialization & Schema

#### `toJSON() -> Object`
Serializes the `RequestAuth` instance to the Postman Collection v2.1.0 JSON format:

```json
{
  "type": "bearer",
  "bearer": [
    {
      "key": "token",
      "value": "{{jwt_secret}}",
      "type": "string"
    }
  ]
}
```

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-request]]
- [[concepts/backend/postman-script-documentation/class-header-list]]
- [[index]]
