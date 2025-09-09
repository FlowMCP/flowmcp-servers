# FlowMCP Server

This repository provides two server implementations compatible with the **FlowMCP framework**:

* 🖥 **LocalServer** — for local, stdio-based execution
* 🌐 **RemoteServer** — for network-based usage via HTTP and SSE

---

## Table of Contents

- [Quickstart](#quickstart)
- [Local Server](#-local-server)
- [Remote Server](#-remote-server)
- [Simple Deployment](#-simple-deployment)
- [Advanced Multi-Route Deployment](#-advanced-multi-route-deployment)
- [Advanced Server Access](#-advanced-server-access)
- [Compatibility](#-compatibility)

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

* Supports 2 transport protocols:

  * `streamable` (HTTP with stateless communication)
  * `sse` (Server-Sent Events)
* Multiple routes and schemas can be activated
* Easily configurable

### 🚀 Example Usage

```js
import { RemoteServer } from 'flowmcp-server'
import { FlowMCP } from 'flowmcp'

const remoteServer = new RemoteServer({ silent: true })

// Define routes with their configuration
const arrayOfRoutes = [
  {
    routePath: '/api',
    protocol: 'sse',
  }
]

// Pre-assign schemas to routes
const objectOfSchemaArrays = {
  '/api': [...] // Your schemas here
}

// Prepare route activation payloads
const { routesActivationPayloads } = RemoteServer.prepareRoutesActivationPayloads({
  arrayOfRoutes,
  objectOfSchemaArrays,
  envObject: process.env
})

remoteServer.start({ routesActivationPayloads })
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

| Protocol      | Description                             |
| ------------- | --------------------------------------- |
| `sse`         | Server-Sent Events, persistent connection |
| `streamable`  | Stateless POST-based HTTP communication   |

---

## 🚀 Simple Deployment

The `Deploy` class provides a quick way to set up servers with command-line parameter support.

### 📝 Example Usage

```js
import { Deploy } from 'flowmcp-server'

// Initialize with command-line arguments and schemas
const { serverType, app, mcps, events, argvs } = Deploy.init({
  argv: process.argv,
  processEnv: process.env,
  arrayOfSchemas: [...] // Your schemas
})

// Access parsed command-line arguments
console.log('Server Type:', serverType)     // 'local' or 'remote'
console.log('Parsed Args:', argvs)          // All CLI parameters
console.log('Express App:', app)            // Express.js app (remote) or McpServer (local)
console.log('MCPs:', mcps)                  // null for local, sessions object for remote
console.log('Events:', events)              // null for local, event emitter for remote

// Start the configured server
await Deploy.start()
```

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

// Initialize the advanced deployment
const { serverType, app, mcps, events, server } = DeployAdvanced.init({ silent: true })

// Define routes with their configuration
const arrayOfRoutes = [
  {
    routePath: '/crypto',
    protocol: 'sse', 
  },
  {
    routePath: '/admin',
    protocol: 'streamable',
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

// Optional: Access server internals for advanced customization
console.log('Server Type:', serverType)  // 'multipleRoutes'

// Express.js app - add custom middleware, routes, etc.
app.use('/health', (req, res) => res.json({ status: 'healthy' }))

// Monitor MCP sessions - track active connections per route
Object.entries(mcps).forEach(([route, { sessionIds }]) => {
  console.log(`Route ${route}: ${Object.keys(sessionIds).length} active sessions`)
})

// Event monitoring - listen to server events
events.on('sessionCreated', ({ protocol, routePath, sessionId }) => {
  console.log(`New ${protocol} session: ${sessionId} on ${routePath}`)
})

// Direct server access - modify configuration, add routes, etc.
server.setConfig({ overwrite: { port: 9000 } })
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

## 🔧 Advanced Server Access

Both `Deploy.init()` and `DeployAdvanced.init()` return important objects that allow deep customization:

| Object | Deploy (Simple) | DeployAdvanced | Description |
|--------|----------------|----------------|-------------|
| `serverType` | `'local'` or `'remote'` | `'multipleRoutes'` | Server configuration type |
| `app` | Express app or McpServer | Express app | Server application instance |
| `mcps` | `null` (local) or sessions object | Sessions object | Active MCP connections per route |
| `events` | `null` (local) or EventEmitter | EventEmitter | Event system for monitoring |
| `argvs` | Parsed CLI arguments | `null` | Command-line parameters (Deploy only) |
| `server` | Not available | RemoteServer instance | Direct server access (DeployAdvanced only) |

### 💡 Use Cases

- **Custom Middleware**: Add authentication, logging, rate limiting via `app`
- **Connection Monitoring**: Track active sessions via `mcps` and `events`  
- **Health Checks**: Add custom endpoints for monitoring
- **Configuration**: Modify server settings via `server` (DeployAdvanced)
- **CLI Integration**: Access parsed arguments via `argvs` (Deploy)

---

## 📌 Compatibility

* **FlowMCP Server version**: `1.5.0`
* **FlowMCP Schema spec version**: `1.2.2`