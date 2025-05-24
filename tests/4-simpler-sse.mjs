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

        this.#app.get('/version', (req, res) => {
            res.json({
                name: 'mixed-transport-server',
                version: '1.0.0',
                build: '2025-05-24', // optional: ISO-Date oder GIT SHA einfügen
                uptime: `${process.uptime().toFixed(1)}s`
            })
        })


        this.#transports = {
            sse: {}
        }

        this.#app.get('/debug/sessions', (req, res) => {
            const activeSessions = Object.entries(this.#transports.sse)
                .map(([id, entry]) => ({
                    sessionId: id,
                    closed: entry.transport.res?.writableEnded ?? null
                }))
            res.json({ activeSSESessions: activeSessions })
        })
    }

    setRoutes({ path, schemas }) {
        const normalizedPath = path.startsWith('/') ? path : '/' + path
        console.log('✅ Registering SSE route at:', `${normalizedPath}/sse`)

        this.#app.get(`${normalizedPath}/sse`, async (req, res) => {
            const transport = new SSEServerTransport(`${normalizedPath}/messages`, res)
            const { sessionId } = transport

            if (this.#transports.sse[sessionId]?.timeoutHandle) {
                clearTimeout(this.#transports.sse[sessionId].timeoutHandle)
            }

            this.#transports.sse[sessionId] = {
                transport,
                timeoutHandle: null
            }

            console.log(`📡 New/Updated SSE connection [sessionId: ${sessionId}]`)

            res.on('close', () => {
                console.log(`🔌 SSE connection closed [sessionId: ${sessionId}], waiting ${this.#sessionTimeoutMs}ms for reconnect`)
                this.#transports.sse[sessionId].timeoutHandle = setTimeout(() => {
                    if (this.#transports.sse[sessionId]?.transport === transport) {
                        console.log(`⏳ Session expired [sessionId: ${sessionId}]`)
                        delete this.#transports.sse[sessionId]
                    }
                }, this.#sessionTimeoutMs)
            })

            try {
                await this.#createAndConnectServer({ transport, schemas })
            } catch (err) {
                console.error("❌ SSE connect error:", err)
                if (!res.headersSent) res.status(500).send("SSE transport error")
            }
        })

        this.#app.get(`${normalizedPath}/messages`, (req, res) => {
            res.status(405).send('Use POST /messages?sessionId=... to send data.')
        })

        this.#app.post(`${normalizedPath}/messages`, async (req, res) => {
            const sessionId = req.query.sessionId
            const entry = this.#transports.sse[sessionId]
            const transport = entry?.transport

            if (!sessionId || !transport) {
                console.warn(`[POST] No transport found for sessionId=${sessionId}`)
                return res.status(400).send('No active transport for sessionId')
            }

            if (transport.res?.writableEnded || transport.res?.closed) {
                console.warn(`[POST] Transport stream already closed for sessionId=${sessionId}`)
                return res.status(400).send('Transport stream closed for sessionId')
            }

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
