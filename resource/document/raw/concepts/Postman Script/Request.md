---

title: Reference Postman requests in scripts

approved: 2025-11-04T00:00:00.000Z

topictype: reference

slug: docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-request

max-toc-depth: 2

ux: v12

-------

The `pm.request` object provides access to the data for the request from a script running within it, and enables you to alter parts of its configuration before the request runs.

In a script that runs before the request, `pm.request` is the request that's about to run. In a script that runs after the response, it's the request that has already run.

The scripts where `pm.request` is available depend on the request type:

* For HTTP requests, it's available in **Pre-request** and **Post-response** scripts.

* For gRPC requests, it's available in **Before invoke** and **After response** scripts, but not in **On message** scripts.

* For GraphQL requests, it's available in **Before query** and **After response** scripts.

## pm.request

Use the `pm.request` methods in your scripts to access and manipulate collection requests.

<Info>

See the Postman [Collection SDK Request reference](https://www.postmanlabs.com/postman-collection/Request.html) for more information.

</Info>

### pm.request.headers.add(header:Header):function

Adds a header with the given name and value for the current request.

### pm.request.headers.remove(headerName:String):function

Deletes the request header with the given name.

### pm.request.headers.upsert(\{key: headerName:String, value: headerValue:String}):function

Inserts the given header name and value if the header doesn't exist. If it exists, the existing header updates with the given value.

## Examples

Add a header with the given name and value for the current request:

```js

pm.request.headers.add({

key: "client-id",

value: "abcdef"

});

```

## pm.request properties

The properties available on `pm.request` depend on the request type.

The following properties are available for more than one request type:

* `pm.request.url:Url` - The request's URL. It's available for every request type.

* `pm.request.auth` - The request's authentication details. It's available for every request type.

* `pm.request.headers:HeaderList` - The list of headers for the current request. It's available for HTTP and GraphQL requests.

### HTTP request properties

The following properties are available only in scripts for HTTP requests.

* `pm.request.method:String` - The HTTP request's method.

* `pm.request.body:RequestBody` - The request body's data. This object is immutable and can't be modified from scripts.

### gRPC request properties

The following properties are available only in scripts for [gRPC requests](/docs/use/send-requests/protocols/grpc/test-examples/).

* `pm.request.methodPath` - The package, service, and method name in `packageName.serviceName.methodName` format.

* `pm.request.metadata` - The list of metadata sent with the request. An individual metadata item is an object containing the `key` and `value` properties. For example, `PropertyList<{ key: string, value: string }>`.

* `pm.request.messages` - The list of outgoing messages. An individual message is a [`PropertyList`](https://www.postmanlabs.com/postman-collection/PropertyList.html) object with the following properties:

* `data` - The contents of the sent message.

* `timestamp` - The time the message was sent, represented as a `Date` object.

For requests with unary and server streaming methods, `pm.request.messages` contains only one message at index `0`, which can be accessed as `pm.request.messages.idx(0)`.

<Info>

For gRPC requests, request mutation isn't supported in the `pm` object.

</Info>

### GraphQL request properties

The following properties are available only in scripts for [GraphQL requests](/docs/use/send-requests/protocols/graphql/graphql-overview/).

* `pm.request.query:String` - The GraphQL query the request sends.

* `pm.request.variables:String` - The GraphQL variables the request sends with the query. These are separate from [Postman variables](/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-variables/).