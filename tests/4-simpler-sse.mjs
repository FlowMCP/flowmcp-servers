import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "sse-single-client-server",
  version: "1.0.0"
});

let currentTransport = null;

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  currentTransport = transport;

  res.on("close", () => {
    console.log("❌ Verbindung beendet");
    currentTransport = null;
    clearInterval(heartbeat);
  });

  await server.connect(transport);

  // Heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(`: keep-alive\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 15000);
});

app.post("/messages", async (req, res) => {
  if (!currentTransport) {
    return res.status(400).send("Kein aktiver Transport verbunden");
  }

  await currentTransport.handlePostMessage(req, res, req.body);
});

app.listen(8080, () => {
  console.log("✅ Läuft auf http://localhost:8080 (ohne Session-ID)");
});
