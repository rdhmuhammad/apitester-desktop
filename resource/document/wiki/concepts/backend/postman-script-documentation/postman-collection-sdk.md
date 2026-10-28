# Postman Collection SDK

**Summary**: Architectural overview, installation, schema version compatibility, and lifecycle patterns of the Postman Collection SDK (`postman-collection`).
**Sources**: `https://www.postmanlabs.com/postman-collection/index.html`
**Last updated**: 2026-10-28

---

## Overview

The **Postman Collection SDK** is an official Node.js module that enables developers to programmatically create, manipulate, traverse, and serialize Postman Collections. Runtimes such as the Postman Desktop App, Newman (Postman CLI runner), and custom API testing tools rely on this SDK to parse collection files and execute requests.

A Postman collection organizes individual HTTP, gRPC, and GraphQL requests into structured hierarchies with nested folders, shared authentication configurations, lifecycle event scripts (pre-request and test), saved example responses, and metadata descriptions.

---

## Installation

The SDK is distributed as an npm package and can be installed via npm or directly from GitHub:

```bash
npm install postman-collection --save
```

---

## Getting Started

Loading a Postman collection from disk, inspecting its contents, and exporting it back to JSON:

```javascript
const fs = require('fs');
const { Collection } = require('postman-collection');

// Load a collection JSON file from disk
const rawData = fs.readFileSync('sample-collection.json', 'utf8');
const collectionData = JSON.parse(rawData);

// Initialize a new Collection instance
const myCollection = new Collection(collectionData);

// Log root-level items and serializable JSON representation
console.log('Collection Name:', myCollection.name);
console.log('Collection JSON:', JSON.stringify(myCollection.toJSON(), null, 2));
```

---

## Postman Collection Schema Compatibility

The collection schema defines the JSON data structures accepted by the constructors of each SDK property (published at `http://schema.postman.com/`). In the SDK, every property class accepts a JSON definition matching the schema and provides symmetrical `.toJSON()` serialization.

| Schema Version | Compatible SDK Versions | Notes |
| :--- | :--- | :--- |
| **1.0** | None | Legacy v1 format; not supported by current SDKs. |
| **2.0** | `< 3.0` | Initial structured schema format. |
| **2.1** | `>= 3.0` | Current industry standard schema (`collection.json v2.1.0`). |

### Constructor & Serialization Symmetry

A key design invariant of the SDK is **bidirectional serialization**:
- Any valid JSON object complying with the Postman Collection v2.1 format can be passed to an SDK constructor (e.g., `new Url(json)`, `new HeaderList(parent, json)`, `new RequestBody(json)`).
- Calling `.toJSON()` on the resulting instance returns a plain JavaScript object matching the original schema structure.

---

## Core SDK Classes

The SDK provides specialized classes representing each constituent part of an HTTP request:
- [[concepts/backend/postman-script-documentation/class-url]]: Parses and serializes URLs, paths, hosts, ports, protocols, and query parameters.
- [[concepts/backend/postman-script-documentation/class-request-auth]]: Encapsulates authentication schemes (Bearer, Basic, OAuth 1.0/2.0, API Key, AWS SigV4) and parameter maps.
- [[concepts/backend/postman-script-documentation/class-header-list]]: Manages ordered, case-insensitive HTTP header lists with upsert and mutation helpers.
- [[concepts/backend/postman-script-documentation/class-request-body]]: Encapsulates request payload modes (`raw`, `formdata`, `urlencoded`, `file`, `graphql`).

---

## Related pages

- [[concepts/backend/postman-script-documentation/index]]
- [[concepts/backend/postman-script-documentation/pm-request]]
- [[concepts/backend/postman-script-documentation/pm-response]]
- [[concepts/backend/postman-prerequest-script-dto]]
- [[index]]
