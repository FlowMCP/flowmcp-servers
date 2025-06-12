import express from 'express'
// import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
// import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { FlowMCP } from 'flowmcp'
import { Event } from './../task/Event.mjs'


class RemoteServer {
    #app
    #config
    #state
    #silent
    #mcps
    #events


    constructor( { silent = false } = {} ) {
        this.#silent = silent || false
        this.#config = { 
            'rootUrl': 'http://localhost', 
            'port': 8080, 
            'suffixes': {
                'sse': '/sse',
                'stickyStreamable': '/sticky',
                'statelessStreamable': '/stateless'
            },
            'serverDescription': {
                'name': 'Remote Server',
                'description': 'A remote Model Context Protocol server',
                'version': '1.2.0'
            }
        }
        this.#events = new Event()
        this.#mcps = {
            'sse': { 'sessionIds': {} },
            'statelessStreamable': { 'sessionIds': {} }
        }

        this.#state = {
            'routes': []
            // 'stickyTransports': { 'sse': {}, 'http': {} }
        }

        this.#app = express()
        this.#app.use( express.json() )

        return true
    }


    setConfig( { overwrite } ) {
        const allowedKeys = [ 'rootUrl', 'port', 'suffixes' ]
        if( !Object.keys( overwrite ).every( key => allowedKeys.includes( key ) ) ) {
            throw new Error( `Invalid keys in config: ${userKeys.filter( key => !allowedKeys.includes( key ) ).join( ', ' )}` )
        }
        Object
            .entries( overwrite )
            .forEach( ( [ key, value ] ) => {
                this.#config[ key ] = value
            } )

        return true
    }


    getApp() {
        return this.#app
    }


    getMcps() {
        return this.#mcps
    }


    getEvents() {
        return this.#events
    }


    async addActivationPayloads( { routePath, activationPayloads, transportProtocols, bearerToken } ) {
        this.#validateSetRoute( { routePath, activationPayloads, transportProtocols } )
        const authMiddleware = bearerToken ? this.#setBearerTokenValidation( { bearerToken } ) : null
        const payload = { routePath, activationPayloads }

        await Promise.all(
            transportProtocols
                .map( async( protocol ) => {
                    if( protocol === 'sse' ) { this.#setStickySseRoute( payload, authMiddleware, protocol ) }
                    // else if( protocol === 'stickyStreamable' ) { this.#setStickyStreamableRoute( payload, authMiddleware, protocol ) }
                    else if( protocol === 'statelessStreamable' ) { await this.#setStatelessStreamableRoute( payload , authMiddleware, protocol ) }
                    else { console.warn( `Unknown transport protocol: ${protocol}` ) }

                    return true
                } )
        )

        return true
    }


    start() {
        const { rootUrl, port } = this.#config
        const server = this.#app.listen( port, () => {
            this.#printRoutes()
        } )

        process.on( 'SIGINT', () => {
            server.close(() => {
                this.#silent ? console.log("HTTP server closed.") : ''
                process.exit()
            } )
        } )

        return true
    }


    #validateSetRoute( { routePath, activationPayloads, transportProtocols } ) {
        const messages = []
        if( !routePath || typeof routePath !== 'string' || !routePath.startsWith('/') ) {
            messages.push( 'Invalid routePath. It must be a string starting with "/".' )
        }

        if( !Array.isArray( activationPayloads ) || activationPayloads.length === 0 ) {
            messages.push( 'activationPayloads must be a non-empty array.' )
        } else {
            activationPayloads
                .forEach( ( obj, index ) => {
                    if( typeof obj !== 'object' ) {
                        messages.push( `activationPayloads[${index}] must be an object.` )
                        return false
                    }
                    const { server, schema, serverParams, activateTags } = obj
                    const n = [ 
                        // [ 'server',       server       ], 
                        [ 'schema',       schema       ], 
                        [ 'serverParams', serverParams ]
                    ]
                        .forEach( ( [ name, value ] ) => {
                            if( !obj[ name ] ) {
                                messages.push( `activationPayloads[${index}] is missing required property: ${name}` )
                            }
                        } )
                } )
        }

        const validProtocols = Object.keys( this.#config.suffixes )
        if( !Array.isArray( transportProtocols ) || transportProtocols.length === 0 ) {
            messages.push( `transportProtocols must be a non-empty array. Valid protocols are: ${validProtocols.join(', ')}` )
        } else {
            transportProtocols
                .forEach( ( protocol, index ) => {
                    if( !validProtocols.includes( protocol ) ) {
                        messages.push( `transportProtocols[${index}] is not a valid protocol. Valid protocols are: ${validProtocols.join(', ')}` )
                    }
                } )
        }

        if( messages.length > 0 ) {
            throw new Error( `Validation failed:\n- ${messages.join( '\n- ' )}` )
        }

        return true
    }


    async #setStatelessStreamableRoute( { routePath, activationPayloads }, authMiddleware, protocol ) {
        let { fullPath } = this
            .#getRoute( { routePath, protocol } )
        const middlewares = authMiddleware ? [authMiddleware] : []

        var server = new McpServer( { name: "", version: "1.0.0" } )
        const { activatedMcpTools: tools } = this.#injectFlowMCP( { server, activationPayloads, protocol } )

        this.#app.post( fullPath, ...middlewares, async ( req, res ) => {
            try {
                const transport = new StreamableHTTPServerTransport( {
                    sessionIdGenerator: undefined,
                } )
                
                this.#mcps[ protocol ]['sessionIds'][ 'default' ] = { server, tools, transport }
                this.#sendEvent( { channelName: 'sessionCreated', message: { protocol, routePath, 'sessionId': 'default' } } )

                res.on( 'close', () => {
                    !this.#silent ? console.log( 'Request closed' ) : ''
                    this.#sendEvent( { channelName: 'sessionClosed', message: { protocol, routePath, 'sessionId': 'default' } } )
                    transport.close()
                    server.close()
                } )

                await server.connect( transport )
                await transport.handleRequest( req, res, req.body )
            } catch( error ) {
                console.error('Error handling MCP request:', error)
                if (!res.headersSent) {
                res
                    .status( 500 )
                    .json( {
                        jsonrpc: '2.0',
                        error: { code: -32603, message: 'Internal server error' },
                        id: null,
                    } )
                }
            }
        } )

        this.#app.get( fullPath, ...middlewares, async ( req, res ) => {
            !this.#silent ? console.log( 'Received GET MCP request' ) : ''
            res
                .writeHead( 405 )
                .end( 
                    JSON.stringify( {
                        jsonrpc: '2.0',
                        error: { code: -32000, message: 'Method not allowed.' },
                        id: null
                    } ) 
                )
        } )

        this.#app.delete( fullPath, ...middlewares, async ( req, res ) => {
            !this.#silent ? console.log( 'Received DELETE MCP request' ) : ''
            res
                .writeHead( 405 )
                .end(
                    JSON.stringify( {
                        jsonrpc: '2.0',
                        error: { code: -32000, message: 'Method not allowed.' },
                        id: null
                    } )
                )
        } )

        return true
    }

/*
    #setStickyStreamableRoute( { routePath, activationPayloads }, authMiddleware, protocol ) {
        let { fullPath } = this
            .#getRoute( { routePath, protocol } )
        const middlewares = authMiddleware ? [authMiddleware] : []

        const server = new McpServer({ name: 'example-server', version: '1.0.0' })
        const { activatedMcpTools: tools } = this.#injectFlowMCP( { server, activationPayloads, protocol } )

        this.#app.post( fullPath, ...middlewares, async( req, res ) => {
            const sessionId = req.headers['mcp-session-id']
            !this.#silent ? console.log(`Incoming POST request at ${fullPath} with session ID: ${sessionId}`) : ''

            let transport
            if( sessionId && this.#mcps[ protocol ]['sessionIds'][ sessionId ] ) {
                !this.#silent ? console.log( `Reusing existing session: ${sessionId}` ) : ''
                transport = this.#mcps[ protocol ]['sessionIds'][ sessionId ]['transport']
            } else if( !sessionId && isInitializeRequest( req.body ) ) {
                !this.#silent ? console.log( `Initializing new session` ) : ''
                transport = new StreamableHTTPServerTransport( {
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: ( newSessionId ) => {
                        !this.#silent ? console.log(`Session initialized: ${newSessionId}`) : ''
                        this.#mcps[ protocol ]['sessionIds'][ transport.sessionId ] = { server, tools, transport }
                        console.log( Object.keys( this.#mcps[ protocol ]['sessionIds'] ).length, 'sessions active' )
                        this.#sendEvent( { channelName: 'sessionCreated', message: { protocol, sessionId: newSessionId } } )
                    }
                } )

                await server.connect( transport )

                transport.onclose = () => {
                    console.log(`Session closed: ${transport.sessionId}`)
                    !this.#silent ? console.log(`Session closed: ${transport.sessionId}`) : ''
                    delete this.#mcps[ protocol ]['sessionIds'][ transport.sessionId ]
                    this.#sendEvent( { channelName: 'sessionClosed', message: { protocol, sessionId: transport.sessionId } } )
                }

            } else {
                !this.#silent ? console.warn(`Invalid request: No valid session ID`) : ''
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                    id: null
                })
                return
            }

            await transport.handleRequest( req, res, req.body )
        } )

        this.#app.get( fullPath, ...middlewares, ( req, res ) => this.#handleSessionRequest( { req, res, protocol } ) )
        this.#app.delete( fullPath, ...middlewares, ( req, res ) => this.#handleSessionRequest( { req, res, protocol } ) )

        return true
    }
*/

    #setStickySseRoute( { routePath, activationPayloads }, authMiddleware, protocol ) {
        const { fullPath, messagesPath } = this
            .#getRoute( { routePath, protocol } )
        const middlewares = authMiddleware ? [ authMiddleware ] : []

        this.#app.get( fullPath, ...middlewares, async ( req, res ) => {
            const server = new McpServer( { name: 'backwards-compatible-server', version: '1.0.0' } )
            const { activatedMcpTools: tools } = this.#injectFlowMCP( { server, activationPayloads, protocol } )

            const transport = new SSEServerTransport( messagesPath, res )
            const { _sessionId } = transport
            this.#mcps[ protocol ]['sessionIds'][ _sessionId ] = { server, tools, transport }
            this.#sendEvent( { channelName: 'sessionCreated', message: { protocol, routePath, 'sessionId': _sessionId } } )

            res.on('close', () => {
                delete this.#mcps[ protocol ]['sessionIds'][ _sessionId ]
                this.#sendEvent( { channelName: 'sessionClosed', message: { protocol, routePath, 'sessionId': _sessionId } } )
            } )

            await server.connect( transport )
        } )

        this.#app.post( messagesPath, ...middlewares, async ( req, res ) => {
            const { sessionId } = req.query
            if( typeof sessionId !== 'string' ) {
                res.status(400).send( 'Invalid sessionId' )
                return
            } else if( Object.hasOwn( this.#mcps[ protocol ]['sessionIds'], sessionId ) === false ) {
                res.status( 400 ).send( 'SessionId not found' )
                return
            } 

            let transport = this.#mcps[ protocol ]['sessionIds'][ sessionId ]['transport']

            if( transport ) { 
                await transport.handlePostMessage( req, res, req.body ) 
                const method = req.body?.method || 'unknown'
                const toolName = req.body?.params?.name

                this.#sendEvent( { channelName: 'callReceived', message: { protocol, routePath, sessionId, method, toolName } } )
            } 
            else { res.status( 400 ).send( 'No transport found for sessionId' ) }
        } )

        return true
    }

/*
    async #handleSessionRequest( { req, res, protocol  } ) {
        const sessionId = req.headers['mcp-session-id']
        if (!sessionId || !this.#mcps[ protocol ]['sessionIds'][ sessionId ] ) {
            res.status( 400 ).send( 'Invalid or missing session ID' )
            return
        }

        const transport = this.#mcps[ protocol ]['sessionIds'][ sessionId ]['transport']
        await transport.handleRequest(req, res)
    }
*/

    #printRoutes() {
        const { rootUrl, port } = this.#config
        !this.#silent ? console.log(`🚀 Server is running on ${rootUrl}:${port}`) : ''
        !this.#silent ? console.log('📜 Available Routes:') : ''
        
        this.#state['routes']
            .forEach(route => {
                !this.#silent ? console.log(`-  ${rootUrl}:${port}${route}`) : ''
            } )

        return true
    }

    
    #getRoute( { routePath, protocol } ) {
        if( !routePath.startsWith( '/' ) ) { routePath = `/${routePath}` }
        const { suffixes } = this.#config
        const suffix = this.#config['suffixes'][ protocol ]
        const keyName = `fullPath`
        const struct = {}
        struct[ keyName ] = `${routePath}${suffix}`
        if( protocol === 'sse' ) { struct['messagesPath'] = `${struct[ keyName ]}/messages` }

        Object
            .values( struct )
            .forEach( route => { this.#state['routes'].push( route ) } )

        return struct
    }


    #injectFlowMCP( { server, activationPayloads } ) {
        const activatedMcpTools = activationPayloads
            .reduce( ( acc, { serverParams, schema, activateTags } ) => {
                // set silent to true because in sse every user has its own server instance.
                const { mcpTools } = FlowMCP
                    .activateServerTools( { server, schema, serverParams, activateTags, 'silent': true } )
                Object
                    .entries( mcpTools )
                    .forEach( ( [ key, value ] ) => {
                        acc[ key ] = value
                    } )

                return acc
            }, {} )

        return { activatedMcpTools }
    }


    #setBearerTokenValidation( { bearerToken } ) {
        !this.#silent ? console.log( `Activate Header: Authorization "Bearer ${bearerToken}"` ) : ''
        return ( req, res, next ) => {
            // !this.#silent ? console.log( 'Authorization middleware triggered', req.headers ) : ''
            const authHeader = req.headers['authorization']
            if( typeof authHeader !== 'string' || !authHeader.startsWith( 'Bearer ' ) ) {
                return res
                    .status( 401 )
                    .json( { error: 'Missing or malformed Authorization header' } )
            }

            const token = `${authHeader}`.replaceAll( 'Bearer ', '' )
            if( token !== bearerToken ) {
                return res
                    .status( 403 )
                    .json( { error: 'Invalid Veritoken' } )
            }

            next()
        }
    }


    #sendEvent( { channelName, message } ) {
        this.#events.sendEvent( { channelName, message } )
        return true
    }
}


export { RemoteServer }