import express from 'express'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { FlowMCP } from 'flowmcp'

// Optional: Wenn du Zod brauchst, sonst entfernen
import { z } from 'zod'

class MixedTransportServer {
    #app
    #port
    #transports
    #sessionTimeoutMs

    constructor({ port = 3000, sessionTimeoutMs = 30000 }) {
        this.#port = port
        this.#sessionTimeoutMs = sessionTimeoutMs
        this.#app = express()
        this.#app.use(express.json())
        this.#transports = {
            sse: {}
        }

        this.#app.get('/debug/sessions', (req, res) => {
            res.json({
                activeSSESessions: Object.keys(this.#transports.sse)
            })
        })
    }

    setRoutes({ path, schemas }) {
        const normalizedPath = path.startsWith('/') ? path : '/' + path
        console.log('✅ Registering SSE route at:', `${normalizedPath}/sse`)

        this.#app.get(`${normalizedPath}/sse`, async (req, res) => {
            const transport = new SSEServerTransport(`${normalizedPath}/messages`, res)
            const { sessionId } = transport

            // Alte Session überschreiben oder aktualisieren
            if (this.#transports.sse[sessionId]?.timeoutHandle) {
                clearTimeout(this.#transports.sse[sessionId].timeoutHandle)
            }

            this.#transports.sse[sessionId] = {
                transport,
                timeoutHandle: null
            }

            console.log(`📡 New/Updated SSE connection [sessionId: ${sessionId}]`)

            // Graceful Timeout einplanen
            const scheduleSessionRemoval = () => {
                this.#transports.sse[sessionId].timeoutHandle = setTimeout(() => {
                    console.log(`⏳ Session expired [sessionId: ${sessionId}]`)
                    delete this.#transports.sse[sessionId]
                }, this.#sessionTimeoutMs)
            }

            res.on('close', () => {
                console.log(`🔌 SSE connection closed [sessionId: ${sessionId}], waiting ${this.#sessionTimeoutMs}ms for reconnect`)
                scheduleSessionRemoval()
            })

            try {
                await this.#createAndConnectServer({ transport, schemas })
            } catch (err) {
                console.error("❌ SSE connect error:", err)
                if (!res.headersSent) res.status(500).send("SSE transport error")
            }
        })

        this.#app.post(`${normalizedPath}/messages`, async (req, res) => {
            const sessionId = req.query.sessionId
            const entry = this.#transports.sse[sessionId]
            const transport = entry?.transport

            if (!sessionId || !transport) {
                console.warn(`[POST] Invalid sessionId=${sessionId}. Known sessions:`, Object.keys(this.#transports.sse))
                return res.status(400).send('No transport found for sessionId')
            }

            // Sitzung ist aktiv – erneutes Timeout zurücksetzen
            if (entry.timeoutHandle) {
                clearTimeout(entry.timeoutHandle)
                entry.timeoutHandle = null
            }

            try {
                await transport.handlePostMessage(req, res, req.body)
            } catch (err) {
                console.error(`❌ Error handling message for sessionId ${sessionId}:`, err)
                if (!res.headersSent) res.status(500).send("Message handling error")
            }
        })
    }

    async #createAndConnectServer({ transport, schemas }) {
        const server = new McpServer({ name: 'mixed-transport-server', version: '1.0.0' })
        schemas.forEach(({ schema, serverParams, activateTags }) => {
            FlowMCP.activateServerTools({ server, schema, serverParams, activateTags })
        })
        await server.connect(transport)
    }

    start() {
        const instance = this.#app.listen(this.#port, () => {
            console.log(`🚀 Server running at http://localhost:${this.#port}`)
        })
        return instance
    }
}


import { schema } from './../schemas/v1.2.0/poap/graphql.mjs'
const schemas = [
    {
        schema,
        serverParams: {},
        activateTags: [],
    }
]

const server = new MixedTransportServer({ port: 8080, sessionTimeoutMs: 30000 }) // 30 Sek. Gnadenfrist
server.setRoutes({ path: '/mcp', schemas })
server.start()
