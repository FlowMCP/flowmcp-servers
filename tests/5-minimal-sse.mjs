import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const server = new McpServer({
  name: "backwards-compatible-server",
  version: "1.0.0"
});

server.tool(
  "calculate-bmi",
  {
    weightKg: z.number(),
    heightM: z.number()
  },
  async ({ weightKg, heightM }) => ({
    content: [{
      type: "text",
      text: String(weightKg / (heightM * heightM))
    }]
  })
);



const app = express();
app.use(express.json());

// Store transports for each session type
const transports = {
  streamable: {},
  sse: {}
};



// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
  // Create SSE transport for legacy clients
console.log( 'SSE' )
  const transport = new SSEServerTransport('/messages', res);
  res.write(`data: {"type": "session", "sessionId": "${transport.sessionId}"}\n\n`);
  

  transports.sse[transport.sessionId] = transport;
  
/*
  res.on("close", () => {
    delete transports.sse[transport.sessionId];
  });
*/
  
  await server.connect(transport);
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
console.log( 'Messages')
  const sessionId = req.query.sessionId
  const transport = transports.sse[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

app.get( '/', (req, res) => {
  res.send(`
    <h1>Model Context Protocol Server</h1>
    <p>Use the <a href="/sse">SSE endpoint</a> for legacy clients. 1.0.1</p>
  `);
} )

console.log( 'TEST' )
console.log( 'Setup Version: 1.0.1' )
app.listen(8080)