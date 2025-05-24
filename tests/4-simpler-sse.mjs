import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "sse-session-server",
  version: "1.0.0"
});

// Aktive SSE-Verbindungen: sessionId → transport
/** @type {Record<string, SSEServerTransport>} */
const transports = {};

// SSE-Verbindung herstellen
app.get("/sse", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;

    transports[sessionId] = transport;
    console.log(`🔌 Neue SSE-Verbindung: sessionId=${sessionId}`);

    res.on("close", () => {
      console.log(`❌ Verbindung geschlossen: sessionId=${sessionId}`);
      delete transports[sessionId];
      clearInterval(heartbeat);
    });

    await server.connect(transport);

    // Session-ID an Client senden
    res.write(`event: sessionId\n`);
    res.write(`data: ${sessionId}\n\n`);

    // Heartbeat senden, um Verbindung offen zu halten
    const heartbeat = setInterval(() => {
      try {
        res.write(`: keep-alive\n\n`);
      } catch (err) {
        console.warn(`⚠️ Heartbeat-Fehler für sessionId=${sessionId}: ${err.message}`);
        clearInterval(heartbeat);
      }
    }, 15000);
  } catch (err) {
    console.error("❌ Fehler im /sse-Endpunkt:", err);
    if (!res.headersSent) {
      res.status(500).send("Interner Serverfehler im SSE-Endpunkt");
    }
  }
});

// Nachrichten vom Client empfangen (SSE-Modus)
app.post("/messages", async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId fehlt oder ist ungültig" });
    }

    const transport = transports[sessionId];
    if (!transport) {
      return res.status(400).json({ error: `Kein aktiver Transport für sessionId=${sessionId}` });
    }

    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error("❌ Fehler beim Nachrichtenempfang:", err);
    res.status(500).json({ error: "Fehler beim Nachrichtenempfang" });
  }
});

// Server starten
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`✅ SSE MCP-Server läuft auf http://localhost:${PORT}`);
});
