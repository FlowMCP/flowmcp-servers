import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";


const app = express();
app.use(express.json());

const server = new McpServer({
  name: "sse-session-server",
  version: "1.0.0"
});

// Speichert aktive Transports
const transports = {};

/**
 * SSE-Endpunkt
 * - erzeugt neuen Transport
 * - registriert sessionId
 * - sendet sessionId initial an den Client
 */
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;

  // Registrieren
  transports[sessionId] = transport;

  res.on("close", () => {
    delete transports[sessionId];
  });

  // Mit MCP-Server verbinden
  await server.connect(transport);

  // Session-ID an Client senden
  res.write(`event: sessionId\n`);
  res.write(`data: ${sessionId}\n\n`);

  // Optional: Heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: keep-alive\n\n`);
  }, 15000);

  res.on("close", () => clearInterval(heartbeat));
});

/**
 * Nachrichtenempfang
 * - erfordert gültige sessionId
 */
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];

  if (!transport) {
    return res.status(400).send("No transport found for sessionId");
  }

  await transport.handlePostMessage(req, res, req.body);
});

// Server starten
app.listen(8080, () => {
  console.log("✅ SSE MCP-Server läuft auf Port 8080");
});
