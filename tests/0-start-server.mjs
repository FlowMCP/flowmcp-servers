import { RemoteMcpServer } from "../src/index.mjs"

const config = {
    'port': 3000,
    'bearerToken': 'password123',
    'routes': [
        {
            'path': '/',
            'handler': (req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Welcome to the Remote MCP Server!');
            }
        },
        {
            'path': '/status',
            'handler': (req, res) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'OK' }));
            }
        },
        {
            'path': '/mcp',
            'handler': (req, res) => {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                });
                res.write(`data: SSE-Verbindung zum MCP-Server hergestellt\n\n`);
            }
        }
    ]
}

const { port, bearerToken } = config

const server = new RemoteMcpServer( port )
server.addAuthentication( bearerToken )
config['routes']
    .forEach( ( { path, handler} ) => {
        server.addRoute( { path, handler } )
    } )
server.start()
