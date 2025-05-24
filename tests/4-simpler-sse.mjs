// server.mjs

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import crypto from 'crypto';

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());

const mcpServer = new Server(
  {
    name: 'example-mcp-sse-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Tools deklarieren
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'add_numbers',
        description: 'Addiert zwei Zahlen',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'Erste Zahl' },
            b: { type: 'number', description: 'Zweite Zahl' }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'get_random_number',
        description: 'Zufallszahl zwischen min und max',
        inputSchema: {
          type: 'object',
          properties: {
            min: { type: 'number', default: 0 },
            max: { type: 'number', default: 100 }
          }
        }
      }
    ]
  };
});

// Tool-Ausführung
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'add_numbers':
      return {
        content: [{ type: 'text', text: `Summe: ${args.a + args.b}` }]
      };
    case 'get_random_number':
      const min = args.min || 0;
      const max = args.max || 100;
      const rand = Math.floor(Math.random() * (max - min + 1)) + min;
      return {
        content: [{ type: 'text', text: `Zufallszahl: ${rand}` }]
      };
    default:
      throw new Error(`Unbekanntes Tool: ${name}`);
  }
});

// Ressourcen
mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'example://server-info',
      name: 'Server Info',
      description: 'Infos zum Server',
      mimeType: 'text/plain'
    }
  ]
}));

mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === 'example://server-info') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `MCP SSE Server v1.0.0\nZeit: ${new Date().toISOString()}`
        }
      ]
    };
  }
  throw new Error(`Unbekannte Resource: ${uri}`);
});

const sessions = new Map();

// SSE Endpoint
app.get('/sse', async (req, res) => {
console.log( 'Request /sse', req.query, req.headers );

  // const sessionId = req.query.sessionId || crypto.randomUUID();
  // console.log('Neue Verbindung mit sessionId:', sessionId);

  const transport = new SSEServerTransport('sse/messages', res);
const { _sessionId: sessionId } = transport

  try {
    await mcpServer.connect(transport);
    sessions.set(sessionId, { transport, res });
  } catch (err) {
    console.error('Verbindungsfehler:', err);
    if (!res.headersSent) res.status(500).end();
    return;
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    console.log(`Verbindung geschlossen für sessionId: ${sessionId}`);
    clearInterval(heartbeat);
    sessions.delete(sessionId);
    transport.close();
  });
});

// Nachrichten-Endpunkt
app.post('/sse/messages', async (req, res) => {
console.log( 'Request /sse/messages', req.body, req.query, req.headers );

  const sessionId = req.query.sessionId || req.headers['mcp-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Ungültige oder fehlende Session-ID' },
      id: null
    });
  }

  try {
    const session = sessions.get(sessionId);
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Fehler beim Verarbeiten', data: err.message },
      id: req.body?.id || null
    });
  }
});

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PORT = 8080
app.listen(PORT, () => {
  console.log(`MCP SSE Server läuft auf http://localhost:${PORT}`);
  console.log(`Test: npx @modelcontextprotocol/inspector \"http://localhost:${PORT}/sse?sessionId=test123\"`);
});
