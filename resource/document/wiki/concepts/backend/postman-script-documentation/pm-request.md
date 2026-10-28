# pm.request

**Summary**: Complete reference for the Postman Sandbox `pm.request` API, detailing lifecycle availability, header mutations, and request properties across HTTP, gRPC, and GraphQL requests.
**Sources**: `https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-request`
**Last updated**: 2026-10-28

---

## Overview

The `pm.request` object provides access to the request data from within scripts executing in the Postman Sandbox. It enables scripts to read and dynamically alter request properties (such as URL, headers, and authentication) before the network call is dispatched.

### Lifecycle Availability

| Request Type | Available In | Not Available In | Notes |
| :--- | :--- | :--- | :--- |
| **HTTP Requests** | **Pre-request** & **Post-response** scripts | N/A | In pre-request scripts, `pm.request` is mutable. In post-response scripts, it reflects the executed request; `pm.request.body` becomes immutable. |
| **gRPC Requests** | **Before invoke** & **After response** scripts | **On message** scripts | Request mutation is **not supported** for gRPC requests via `pm`. |
| **GraphQL Requests** | **Before query** & **After response** scripts | N/A | GraphQL queries and variables are accessible via dedicated properties. |

---

## Header Mutation Methods

The sandbox exposes mutation methods on `pm.request.headers` to modify outgoing headers before dispatch:

### `pm.request.headers.add(header: Header): function`
Adds a header with the specified key and value to the current request.
```javascript
pm.request.headers.add({
  key: "X-Client-ID",
  value: "abcdef12345"
});
```

### `pm.request.headers.remove(headerName: String): function`
Removes the request header matching the given key name.
```javascript
pm.request.headers.remove("X-Deprecated-Token");
```

### `pm.request.headers.upsert({ key: String, value: String }): function`
Inserts the header if it does not already exist; updates the existing header's value if it is already present.
```javascript
pm.request.headers.upsert({
  key: "Authorization",
  value: `Bearer ${pm.environment.get("access_token")}`
});
```

---

## Properties Reference

### Shared Properties (Multi-Protocol)

- **`pm.request.url`** (`Url`): The request's URL object. Available for HTTP, gRPC, and GraphQL requests. Extends the Postman Collection [[concepts/backend/postman-script-documentation/class-url]].
- **`pm.request.auth`** (`RequestAuth`): Authentication configuration assigned to the request. Extends [[concepts/backend/postman-script-documentation/class-request-auth]].
- **`pm.request.headers`** (`HeaderList`): The list of request headers. Available for HTTP and GraphQL requests. Extends [[concepts/backend/postman-script-documentation/class-header-list]].

### HTTP Request Properties

- **`pm.request.method`** (`String`): The HTTP method string (e.g., `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"`).
- **`pm.request.body`** (`RequestBody`): The request payload configuration and data. Extends [[concepts/backend/postman-script-documentation/class-request-body]]. In post-response scripts, this property is read-only and immutable.

### gRPC Request Properties

- **`pm.request.methodPath`** (`String`): Package, service, and method identifier formatted as `packageName.serviceName.methodName`.
- **`pm.request.metadata`** (`PropertyList`): List of metadata sent with the gRPC request, where each item contains `key` and `value` properties.
- **`pm.request.messages`** (`PropertyList`): Outgoing message queue. For unary and server streaming calls, contains a single message at index 0 (`messages.idx(0)`).

### GraphQL Request Properties

- **`pm.request.query`** (`String`): The GraphQL document/query string sent with the request.
- **`pm.request.variables`** (`String`): The serialized JSON string representing GraphQL variables.

---

## Usage Examples

### 1. Dynamic Header Injection & HMAC Calculation (Pre-request)

```javascript
// Calculate dynamic timestamp and signature in pre-request script
const timestamp = Date.now().toString();
const secret = pm.environment.get("api_secret");
const signature = CryptoJS.HmacSHA256(timestamp, secret).toString();

pm.request.headers.upsert({ key: "X-Timestamp", value: timestamp });
pm.request.headers.upsert({ key: "X-Signature", value: signature });
```

### 2. Inspecting Request in Post-Response (Test Script)

```javascript
// Verify that the sent request had the expected method and headers
pm.test("Request used POST method", function () {
  pm.expect(pm.request.method).to.eql("POST");
});

pm.test("Request contained authorization header", function () {
  pm.expect(pm.request.headers.has("Authorization")).to.be.true;
});
```

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-response]]
- [[concepts/backend/postman-script-documentation/class-url]]
- [[concepts/backend/postman-script-documentation/class-header-list]]
- [[concepts/backend/postman-script-documentation/class-request-body]]
- [[concepts/backend/postman-script-documentation/class-request-auth]]
- [[concepts/backend/postman-prerequest-script-dto]]
- [[index]]
