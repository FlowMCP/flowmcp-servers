import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

/** @typedef {import('@modelcontextprotocol/sdk/types.js').CallToolResult} CallToolResult */

const server = new McpServer(
  { name: "backwards-compatible-server", version: "1.0.0" },
  { capabilities: { logging: {} } }
);

// 🔧 Define a simple test tool
server.tool(
  "ping",
  "Returns a pong message",
  {},
  /**
   * @param {*} _args
   * @param {{ sendNotification: Function }} context
   * @returns {Promise<CallToolResult>}
   */
  async (_args, { sendNotification }) => {
    await sendNotification({
      method: "notifications/message",
      params: { level: "info", data: "pong" },
    });

    return {
      content: [{ type: "text", text: "pong" }],
    };
  }
);

const app = express();
app.use(express.json());

/** @type {{ streamable: Record<string, StreamableHTTPServerTransport>, sse: Record<string, SSEServerTransport> }} */
const transports = {
  streamable: {},
  sse: {},
};
/*
// 🔹 Streamable HTTP endpoint (modern clients)
app.all("/", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport(req, res);
    const { sessionId } = transport;

    transports.streamable[sessionId] = transport;
    console.log(`📡 New Streamable HTTP connection [sessionId: ${sessionId}]`);

    transport.onclose = () => {
      console.log(`🔌 Closed Streamable HTTP connection [sessionId: ${sessionId}]`);
      delete transports.streamable[sessionId];
    };

    await server.connect(transport);
  } catch (err) {
    console.error("❌ Streamable HTTP error:", err);
    if (!res.headersSent) {
      res.status(500).send("Streamable HTTP transport error");
    }
  }
});
*/
// 🔹 SSE connection (legacy clients)
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const { sessionId } = transport;

  transports.sse[sessionId] = transport;
  console.log(`📡 New SSE connection [sessionId: ${sessionId}]`);

  res.on("close", () => {
    console.log(`🔌 Closed SSE connection [sessionId: ${sessionId}]`);
    delete transports.sse[sessionId];
  });

  try {
    await server.connect(transport);
  } catch (err) {
    console.error("❌ SSE connection error:", err);
    if (!res.headersSent) {
      res.status(500).send("Failed to establish SSE transport");
    }
  }
});

// 🔹 Legacy message POST endpoint
app.post("/messages", async (req, res) => {
  const sessionId = /** @type {string | undefined} */ (req.query.sessionId);
  const transport = transports.sse[sessionId];

  if (!sessionId || !transport) {
    console.warn(`⚠️ Invalid or missing sessionId on /messages: ${sessionId}`);
    return res.status(400).send("No transport found for sessionId");
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error(`❌ Error handling message for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).send("Failed to handle message");
    }
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ MCP server running at: http://localhost:${PORT}`);
  console.log(`   • Streamable HTTP: POST/GET at '/'`);
  console.log(`   • Legacy SSE: GET /sse + POST /messages?sessionId=...`);
});
