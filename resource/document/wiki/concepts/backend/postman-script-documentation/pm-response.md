# pm.response

**Summary**: Complete reference for the Postman Sandbox `pm.response` API, detailing lifecycle availability, body parsers, status codes, header inspections, and Ajv JSON Schema validation assertions.
**Sources**: `https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-response`
**Last updated**: 2026-10-28

---

## Overview

The `pm.response` object provides access to the network response payload, headers, metadata, and performance metrics returned by an executed request. It is exposed to post-execution test scripts in the Postman Sandbox.

### Lifecycle Availability

| Request Type | Available In | Not Available In | Notes |
| :--- | :--- | :--- | :--- |
| **HTTP Requests** | **Post-response** (Test) scripts | **Pre-request** scripts | Exposes HTTP status code, status text, raw/JSON body, and response headers. |
| **gRPC Requests** | **After response** scripts | **Before invoke** & **On message** | Exposes gRPC status codes (0 = OK), metadata, trailers, and stream messages. |
| **GraphQL Requests** | **After response** scripts | **Before query** scripts | Exposes query `data`, `errors` array, and underlying HTTP transport metadata. |

---

## Response Body Methods

These methods are available in post-response scripts for HTTP requests:

### `pm.response.text(): Function`
Retrieves the raw response body as a UTF-8 text string.
```javascript
const rawBody = pm.response.text();
pm.expect(rawBody).to.include("Success");
```

### `pm.response.json(): Function`
Parses the response body as a JSON object, throwing a `SyntaxError` if the payload is not valid JSON.
```javascript
const responseData = pm.response.json();
pm.expect(responseData.data.id).to.eql(101);
```

---

## Properties Reference

### Shared Properties (Multi-Protocol)

- **`pm.response.responseTime`** (`Number`): Total response duration in milliseconds. For gRPC streaming requests, represents the cumulative duration of the entire stream execution.
- **`pm.response.responseSize`** (`Number`): Byte size of the response payload received (available for HTTP and GraphQL requests).

### HTTP Response Properties

- **`pm.response.code`** (`Number`): Numerical HTTP status code (e.g., `200`, `201`, `400`, `401`, `500`).
- **`pm.response.status`** (`String`): HTTP status text phrase (e.g., `"OK"`, `"Created"`, `"Bad Request"`).
- **`pm.response.headers`** (`HeaderList`): Response headers represented as a [[concepts/backend/postman-script-documentation/class-header-list]].

### gRPC Response Properties

- **`pm.response.statusCode`** (`Number`): gRPC response status code (`0` indicates `OK` / success).
- **`pm.response.metadata`** (`PropertyList`): Key-value metadata pairs received with the response.
- **`pm.response.trailers`** (`PropertyList`): Trailer key-value pairs received after message completion.
- **`pm.response.messages`** (`PropertyList`): Incoming messages. For unary and client streaming calls, the sole message is located at index 0 (`pm.response.messages.idx(0)`).

### GraphQL Response Properties

- **`pm.response.data`** (`Object`): The query result object containing the requested GraphQL fields.
- **`pm.response.errors`** (`Array<Object>`): Array of error objects (each containing `message`, `locations`, `path`). Undefined or absent when the query executes without error.
- **`pm.response.transport.http`** (`Object`): HTTP transport details (`statusCode`, `headers`), as GraphQL runs over HTTP.

---

## Response Assertions & BDD Matchers

Postman integrates Chai BDD syntax directly on `pm.response`:

```javascript
pm.test("Status code is 200 OK", function () {
  pm.response.to.have.status(200);
  pm.response.to.be.ok;
  pm.response.to.be.success;
});

pm.test("Response time is acceptable", function () {
  pm.expect(pm.response.responseTime).to.be.below(500);
});

pm.test("Content-Type header is JSON", function () {
  pm.response.to.have.header("Content-Type", "application/json; charset=utf-8");
});
```

---

## JSON Schema Validation

Postman embeds version 6.12.5 of the **Ajv JSON Schema Validator**, allowing direct schema validation via BDD syntax:

```javascript
pm.response.<bdd-syntax>.jsonSchema(schema, [options]);
```

### HTTP Validation Example

```javascript
const schema = {
  type: "object",
  required: ["id", "email", "isActive"],
  properties: {
    id: { type: "integer" },
    email: { type: "string", format: "email" },
    isActive: { type: "boolean" }
  }
};

pm.test("Response matches user schema", function () {
  pm.response.to.have.jsonSchema(schema);
});
```

### gRPC Message Validation Example

For gRPC requests, the `jsonSchema` matcher is invoked on `pm.response.messages`:

```javascript
const messageSchema = {
  type: "object",
  required: ["resultCode"],
  properties: {
    resultCode: { type: "number" }
  }
};

pm.test("gRPC stream message matches schema", function () {
  pm.response.messages.to.have.jsonSchema(messageSchema);
});
```

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-request]]
- [[concepts/backend/postman-script-documentation/class-header-list]]
- [[concepts/backend/postman-prerequest-script-dto]]
- [[index]]
