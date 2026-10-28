# Class: HeaderList

**Summary**: Specification and API reference for the Postman Collection SDK `HeaderList` class, managing ordered, case-insensitive collections of HTTP headers with upsert, query, and dictionary serialization methods.
**Sources**: `https://www.postmanlabs.com/postman-collection/HeaderList.html`
**Last updated**: 2026-10-28

---

## Overview

The `HeaderList` class represents a collection of HTTP headers within the Postman Collection SDK. It extends `PropertyList` to provide specialized support for HTTP header operations, such as case-insensitive lookup, duplicate key handling, enabling/disabling individual headers, upserting values, and serializing into plain key-value objects or raw HTTP wire-format strings.

### Inheritance
- Extends: `PropertyList` (from `postman-collection`)

---

## Constructor

### `new HeaderList(parent, headers)`
Initializes a new `HeaderList` instance with optional parent context and initial header definitions.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `parent` | `Object` | No | Parent item or request object. |
| `headers` | `Array<Header>` \| `Array<Object>` | No | Initial array of header objects (each with `key`, `value`, `disabled`, and `description`). |

```javascript
const { HeaderList } = require('postman-collection');

const headers = new HeaderList(null, [
  { key: "Content-Type", value: "application/json" },
  { key: "Accept", value: "*/*" },
  { key: "X-Debug", value: "true", disabled: true }
]);
```

---

## Static Methods

### `HeaderList.isHeaderList(obj) -> Boolean`
Checks whether the given object is an instance of `HeaderList`.

```javascript
HeaderList.isHeaderList(headers); // true
```

---

## Instance Methods

### Mutation & Management

#### `add(item)` / `append(item)`
Appends a new header or header definition to the end of the list.
```javascript
headers.add({ key: "User-Agent", value: "PostmanRuntime/7.36.0" });
```

#### `prepend(item)`
Inserts or moves a header to the beginning of the list.

#### `insert(item, before)` / `insertAfter(item, after)`
Inserts a header before or after a reference header item or index.

#### `upsert(item) -> Boolean`
Updates an existing header matching `item.key` (case-insensitively). If the header does not exist, appends it.
```javascript
headers.upsert({ key: "Authorization", value: "Bearer token123" });
```

#### `remove(predicate, context)`
Removes all headers matching a string key, item instance, or predicate function.
```javascript
// Remove by key name
headers.remove("X-Debug");

// Remove with predicate function
headers.remove(header => header.key.startsWith("X-Custom-"));
```

#### `clear()`
Removes all headers from the list.

---

### Lookup & Inspection

#### `get(key) -> PropertyList.Type | *`
Retrieves the header item matching the specified key. Case-insensitive in accordance with HTTP specifications.
```javascript
const contentType = headers.get("content-type");
console.log(contentType.value); // "application/json"
```

#### `has(item, value) -> Boolean`
Checks whether a header with the given key (and optional matching value) exists in the list.
```javascript
headers.has("Accept"); // true
headers.has("Content-Type", "application/json"); // true
```

#### `idx(index) -> Header`
Retrieves the header at the zero-based index position.

#### `indexOf(item) -> Number`
Returns the numerical index of a header item in the list.

#### `count() -> Number`
Returns the total number of headers in the list (including disabled ones).

#### `contentSize() -> Number`
Calculates and returns the byte size of the serialized header block.

---

### Functional Iteration

`HeaderList` supports standard functional iteration methods:
- **`each(iterator, context)`**: Loops over every header.
- **`map(iterator, context)`**: Transforms headers into an array.
- **`filter(rule, context)`**: Filters headers based on criteria.
- **`reduce(iterator, accumulator, context)`**: Reduces headers to an accumulated value.
- **`find(rule, context)`**: Finds the first matching header.

```javascript
// Collect all enabled header keys
const enabledKeys = headers
  .filter(h => !h.disabled)
  .map(h => h.key);
```

---

### Serialization & Object Conversion

#### `toObject(excludeDisabled, caseSensitive, multiValue, sanitizeKeys) -> Object`
Converts the header list into a plain JavaScript key-value dictionary object.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `excludeDisabled` | `Boolean` | `false` | When `true`, filters out headers marked `disabled: true`. |
| `caseSensitive` | `Boolean` | `false` | Treats header keys strictly with their original casing. |
| `multiValue` | `Boolean` | `false` | If `true`, returns arrays for duplicate header keys instead of joining with `, `. |
| `sanitizeKeys` | `Boolean` | `false` | Removes entries with empty or falsy keys. |

```javascript
const headerDict = headers.toObject(true);
// { "content-type": "application/json", "accept": "*/*" }
```

#### `toString() -> String`
Converts the header list into a raw HTTP header block separated by CRLF (`\r\n`).

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-request]]
- [[concepts/backend/postman-script-documentation/pm-response]]
- [[concepts/backend/postman-prerequest-script-dto]]
- [[index]]
