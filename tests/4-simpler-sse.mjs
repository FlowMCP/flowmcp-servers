// server.mjs

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { FlowMCP } from "flowmcp";


const server = new McpServer({
  name: "backwards-compatible-server",
  version: "1.0.0"
});

import { schema } from './../schemas/v1.2.0/poap/graphql.mjs'
const schemas = [
    {
        schema,
        'serverParams': {},
        'activateTags': [],
    }
]

schemas
    .forEach(( { serverParams, schema, activateTags } ) => {
        FlowMCP.activateServerTools( { server, schema, serverParams, activateTags, silent: false } )
    } )



// Express App einrichten
const app = express();
app.use(express.json());

// Transportspeicher für Session-Management
const transports = {
  streamable: /** @type {Record<string, StreamableHTTPServerTransport>} */ ({}),
  sse: /** @type {Record<string, SSEServerTransport>} */ ({})
};

// Modernes Streamable HTTP-Endpunkt
app.all('/mcp', async (req, res) => {
  // Beispielhafte Session-ID – in der Praxis dynamisch generieren oder bereitstellen
  const sessionId = req.query.sessionId || "default-session";

  const transport = new StreamableHTTPServerTransport(req, res);
  transports.streamable[sessionId] = transport;

  res.on("close", () => {
    delete transports.streamable[sessionId];
  });

  await server.connect(transport);
});

// Legacy SSE-Endpunkt
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports.sse[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports.sse[transport.sessionId];
  });

  // Warte, bis der MCP-Server den Transport gestartet hat (inkl. Header senden)
  await server.connect(transport);

  // Jetzt ist es sicher, Keep-Alive Nachrichten zu senden
  const interval = setInterval(() => {
    try {
      res.write(`: keep-alive\n\n`);
    } catch (err) {
      clearInterval(interval);
    }
  }, 15000);

  res.on("close", () => {
    clearInterval(interval);
  });
});


// Legacy Nachrichten-Endpunkt
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.sse[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

// Server starten
app.listen(8080, () => {
  console.log("Server läuft auf Port 8080");
});
