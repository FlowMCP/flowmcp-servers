import express from 'express'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { FlowMCP } from 'flowmcp'


class StreamableServer {
    #app
    #port
    #transports


    constructor( { port=8080 } ) {
        this.#port = port
        this.#app = express()
        this.#app.use( express.json() )
        this.#transports = {}
    }


    setRoute( { path } ) {
        this.#app.post( path, async ( req, res ) => {
            const sessionId = req.headers['mcp-session-id']
            console.log(`Incoming POST request at ${path} with session ID: ${sessionId}`)

            let transport
            if( sessionId && this.#transports[ sessionId ] ) {
                console.log(`Reusing existing session: ${sessionId}`)
                transport = this.#transports[ sessionId ]
            } else if ( !sessionId && isInitializeRequest( req.body ) ) {
                console.log(`Initializing new session`)
                transport = new StreamableHTTPServerTransport( {
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: ( newSessionId ) => {
                        console.log(`Session initialized: ${newSessionId}`)
                        this.#transports[ newSessionId ] = transport
                    }
                } )

                transport.onclose = () => {
                    if( transport.sessionId ) {
                        console.log(`Closing session: ${transport.sessionId}`)
                        delete this.#transports[ transport.sessionId ]
                    }
                }

                const server = new McpServer( { name: 'example-server', version: '1.0.0' } )
                schemas
                    .forEach( ( { serverParams, schema, activateTags } ) => {
                        FlowMCP.activateServerTools( { server, schema, serverParams, activateTags } )
                    } )


                await server.connect( transport )
            } else {
                console.warn(`Invalid request: No valid session ID`)
                res
                    .status( 400 )
                    .json( { jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: No valid session ID provided' }, id: null } )
                return
            }
            
            await transport.handleRequest( req, res, req.body )
        } )

        // this.#app.get( path, this.#handleSessionRequest )
        // this.#app.delete( path, this.#handleSessionRequest )
    }


    start() {
        const server = this.#app.listen( this.#port, () => {
            console.log( `Server is running on http://localhost:${this.#port}` )
        } )

        return server
    }


    async #handleSessionRequest( req, res ) {
        const sessionId = req.headers['mcp-session-id']
        if( !sessionId || !this.#transports[ sessionId ] ) {
            res
                .status( 400 )
                .send( 'Invalid or missing session ID' )
            return
        }

        const transport = this.#transports[ sessionId ]
        await transport.handleRequest( req, res )
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



const remote = new StreamableServer( { port: 8080 } )
remote.setRoute( { path: '/mcp',  schemas, serverParams: {}, } )
const serverInstance = remote.start()

process
    .on('SIGINT', () => {
        serverInstance.close(() => {
            console.log("HTTP server closed.");
            process.exit();
        } )
    } )