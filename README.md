# FlowMCP Server

This repository provides two server implementations compatible with the **FlowMCP framework**:

* 🖥 **LocalServer** — for local, stdio-based execution
* 🌐 **RemoteServer** — for network-based usage via HTTP and SSE

---

## 🖥 Local Server

The `LocalServer` is designed for local workflows, using standard input/output streams. It is ideal for CLI tools, testing, and development environments.

### ✅ Features

* Lightweight and dependency-free I/O via stdin/stdout
* Fully supports `FlowMCP.activateServerTools(...)`
* Uses `StdioServerTransport`

### 🚀 Example Usage

```js
import { LocalServer } from 'flowmcp-server'
import { FlowMCP } from 'flowmcp'
import { SchemaImporter } from 'schemaimporter'

const schemaList = await SchemaImporter.get({ withSchema: true })
const arrayOfSchemas = schemaList.map(({ schema }) => schema)

const { activationPayloads } = FlowMCP.prepareActivations({ arrayOfSchemas })

const localServer = new LocalServer({ silent: true })
localServer.addActivationPayloads({ activationPayloads })

await localServer.start()
```

### 🔧 Configuration

```js
localServer.setConfig({
  overwrite: {
    serverDescription: {
      name: 'My Local Server',
      description: 'CLI test server',
      version: '1.2.2'
    }
  }
})
```

---

## 🌐 Remote Server

The `RemoteServer` provides HTTP-based access to FlowMCP schemas using various protocols. It is ideal for frontend apps, remote agents, and networked integrations.

### ✅ Features

* Supports 3 transport protocols:

  * `statelessStreamable`
  * `stickyStreamable`
  * `sse` (Server-Sent Events)
* Optional Bearer token authentication
* Multiple routes and schemas can be activated
* Easily configurable

### 🚀 Example Usage

```js
import { RemoteServer } from 'flowmcp-server'
import { FlowMCP } from 'flowmcp'

const remoteServer = new RemoteServer({ silent: true })

const { activationPayloads } = FlowMCP.prepareActivations({
  arrayOfSchemas: [...],
  envObject: process.env,
  activateTags: ['example.route']
})

await remoteServer.addActivationPayloads({
  routePath: '/api',
  activationPayloads,
  transportProtocols: ['sse', 'stickyStreamable'],
  bearer: 'mysecrettoken'
})

remoteServer.start()
```

### 🔧 Configuration

```js
remoteServer.setConfig({
  overwrite: {
    port: 8081,
    rootUrl: 'http://mydomain.com'
  }
})
```

### 📡 Supported Transport Protocols

| Protocol              | Description                               |
| --------------------- | ----------------------------------------- |
| `sse`                 | Server-Sent Events, persistent connection |
| `stickyStreamable`    | HTTP with reusable sessions (via headers) |
| `statelessStreamable` | Stateless POST-based HTTP communication   |

---

## 🔐 Authentication (Optional)

When the `bearer` option is set, incoming requests must include the following header:

```
Authorization: Bearer <TOKEN>
```

Invalid or missing tokens will result in `401 Unauthorized` or `403 Forbidden` responses.

---

## 📌 Compatibility

* **FlowMCP Server version**: `1.2.0+`
* **FlowMCP Schema spec version**: `1.2.2`