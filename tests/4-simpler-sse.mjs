import express from 'express'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { FlowMCP } from 'flowmcp'
import { z } from 'zod'


class MixedTransportServer {
    #app
    #port
    #transports



    constructor({ port = 3000 }) {
        this.#port = port
        this.#app = express()
        this.#app.use(express.json())


        this.#transports = {
            streamable: {},
            sse: {}
        }
    }

    setRoutes({ path, schemas }) {
        const normalizedPath = path.startsWith('/') ? path : '/' + path

        // 🔹 SSE für Legacy-Clients
        console.log('Registering SSE route at:', `${normalizedPath}/sse`)

        this.#app.get(`${normalizedPath}/sse`, async (req, res) => {
            const transport = new SSEServerTransport(`${normalizedPath}/messages`, res)
            const { sessionId } = transport

            this.#transports.sse[sessionId] = transport
            console.log(`📡 New SSE connection [sessionId: ${sessionId}]`)

            res.on('close', () => {
                console.log(`🔌 Closed SSE connection [sessionId: ${sessionId}]`)
                delete this.#transports.sse[sessionId]
            })

            try {
                await this.#createAndConnectServer( { transport, schemas } )
            } catch (err) {
                console.error("❌ SSE error:", err)
                if (!res.headersSent) res.status(500).send("SSE transport error")
            }
        })

        this.#app.post(`${normalizedPath}/messages`, async (req, res) => {
            const sessionId = req.query.sessionId
            const transport = this.#transports.sse[sessionId]

            if (!sessionId || !transport) {
                res.status(400).send('No transport found for sessionId')
                return
            }

            try {
                await transport.handlePostMessage(req, res, req.body)
            } catch (err) {
                console.error(`Error handling message for ${sessionId}:`, err)
                if (!res.headersSent) res.status(500).send("Error processing message")
            }
        })
    }

    async #createAndConnectServer( { transport , schemas } ) {
        const server = new McpServer({ name: 'mixed-transport-server', version: '1.0.0' })
        schemas.forEach(({ schema, serverParams, activateTags }) => {
            FlowMCP.activateServerTools({ server, schema, serverParams, activateTags })
        })

        await server.connect(transport)
    }

    start() {
        const instance = this.#app.listen(this.#port, () => {
            console.log(`Server running at http://localhost:${this.#port}`)
        })

        return instance
    }
}





import { schema } from './../schemas/v1.2.0/poap/graphql.mjs' 
const schemas = [
    {
        schema,
        'serverParams': {},
        'activateTags': [],
    }
]


const remote = new MixedTransportServer( { port: 8080 } )
remote.setRoutes({ path: 'mcp', schemas })
const serverInstance = remote.start()
process.on('SIGINT', () => {
    serverInstance.close(() => {
        console.log("Server shutdown complete.")
        process.exit()
    })
})
