# FlowMCP Server

This repository provides two server implementations compatible with the **FlowMCP framework**:

* 🖥 **LocalServer** — for local, stdio-based execution
* 🌐 **RemoteServer** — for network-based usage via HTTP and SSE

---

## Quickstart 

Deploy with DigitalOcean

> An autodeploy is only available for a stateless server (streamableHTTP) . 

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/flowmcp/flowmcp-servers/tree/main)



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

const schemaList = await SchemaImporter.get( { withSchema: true } )
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

## 🚀 Advanced Multi-Route Deployment

The `DeployAdvanced` class enables deployment of multiple routes with different schemas and protocols. Perfect for complex API setups.

### 🌟 Key Features

* Multiple routes with independent schema sets
* Pre-filtered schema assignment per route
* Mixed transport protocols (SSE + HTTP)
* Individual authentication per route

### 📝 Example Usage

```js
import { DeployAdvanced } from 'flowmcp-server'
import { FlowMCP } from 'flowmcp'

// Initialize the advanced deployment
DeployAdvanced.init({ silent: true })

// Define routes (simplified - no filtering logic)
const arrayOfRoutes = [
  {
    routePath: '/crypto',
    protocol: 'sse', 
    bearerToken: 'crypto-secret'
  },
  {
    routePath: '/admin',
    protocol: 'streamable',
    bearerToken: 'admin-secret'
  }
]

// Pre-assign schemas to routes (user controls filtering)
const objectOfSchemaArrays = {
  '/crypto': [
    // Crypto-related schemas only
    coinGeckoSchema,
    deFiLlamaSchema
  ],
  '/admin': [
    // Admin-only schemas
    userManagementSchema,
    systemStatsSchema
  ]
}

// Start with pre-configured routes and schemas
DeployAdvanced.start({
  arrayOfRoutes,
  objectOfSchemaArrays, 
  envObject: process.env,
  rootUrl: 'https://api.example.com',
  port: 8080
})
```

### 🔄 Migration from v1.3.x

**OLD API (v1.3.x):**
```js
const routes = [{
  includeNamespaces: ['coingecko'],
  excludeNamespaces: ['debug'],
  activateTags: ['production'],
  routePath: '/crypto',
  protocol: 'sse',
  bearerToken: 'token'
}]

DeployAdvanced.start({
  routes,                    // ❌ Old parameter
  arrayOfSchemas: [...],     // ❌ Global array
  envObject: process.env
})
```

**NEW API (v1.4.x):**
```js
const arrayOfRoutes = [{
  routePath: '/crypto',      // ✅ Simplified route
  protocol: 'sse',
  bearerToken: 'token'
}]

const objectOfSchemaArrays = {
  '/crypto': [...]           // ✅ Pre-filtered per route
}

DeployAdvanced.start({
  arrayOfRoutes,             // ✅ New parameter
  objectOfSchemaArrays,      // ✅ Route-specific schemas  
  envObject: process.env
})
```

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