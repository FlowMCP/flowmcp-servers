// version 2 - with optional port and rootUrl in start()

import express from 'express'
import { FlowMCP } from 'flowmcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

import { Event } from './../task/Event.mjs'


class RemoteServer {
    #app
    #mcps = {}
    #silent
    #config
    #events
    #routeAuth = {}


    constructor( { silent = false } ) {
        this.#silent = silent
        this.#config = {
            rootUrl: 'http://localhost',
            port: 8080,
            suffixes: {
                sse: '/sse',
                streamable: '/streamable'
            },
            serverDescription: {
                name: 'Remote Server',
                description: 'A remote Model Context Protocol server',
                version: '1.0.0'
            }
        }
        this.#events = new Event()

        this.#app = express()
        this.#app.use( express.json() )
        this.#app.use( this.#bearerAuthMiddleware.bind( this ) )
    }


    setConfig( { overwrite } ) {
        const allowedKeys = [ 'rootUrl', 'port', 'suffixes' ]

        if( !Object.keys( overwrite ).every( ( key ) => allowedKeys.includes( key ) ) ) {
            throw new Error( `Invalid keys in config: ${Object.keys( overwrite ).filter( ( key ) => !allowedKeys.includes( key ) ).join( ', ' )}` )
        }

        Object
            .entries( overwrite )
            .forEach( ( [ key, value ] ) => {
                this.#config[ key ] = value
            } )

        return true
    }


    getEvents() {
        return this.#events
    }


    getApp() {
        return this.#app
    }


    getMcps() {
        return this.#mcps
    }


    static prepareRoutesActivationPayloads( { routes, arrayOfSchemas, envObject } ) {
        const routesActivationPayloads = routes
            .
            reduce( ( acc, route ) => {
                const { includeNamespaces: iN, excludeNamespaces: eN, activateTags: aT, routePath, protocol, bearerToken } = route
                const { includeNamespaces, excludeNamespaces, activateTags } = [
                    [ 'includeNamespaces', iN ],
                    [ 'excludeNamespaces', eN ],
                    [ 'activateTags'     , aT ]
                ]
                    .reduce( ( acc, [ key, value ] ) => {
                        acc[ key ] = value ?? []
                        return acc
                    }, {} )
        
                const { filteredArrayOfSchemas } = FlowMCP.filterArrayOfSchemas( { arrayOfSchemas, includeNamespaces, excludeNamespaces, activateTags } )
                if( filteredArrayOfSchemas.length === 0 ) { throw new Error( `No schemas found for route: ${JSON.stringify( route )}` ) }
                    
                const { activationPayloads } = FlowMCP.prepareActivations( { arrayOfSchemas: filteredArrayOfSchemas, envObject } )

                acc.push( { routePath, protocol, bearerToken, activationPayloads } )
                return acc
            }, [] )

        return { routesActivationPayloads }
    }


    start( { routesActivationPayloads, rootUrl, port } ) {
        const finalRootUrl = rootUrl !== undefined ? rootUrl : this.#config.rootUrl
        const finalPort = port !== undefined ? port : this.#config.port

        const { status, messages } = RemoteServer.#validationStart( {
            routesActivationPayloads,
            rootUrl: finalRootUrl,
            port: finalPort
        } )
        if( !status ) {
            throw new Error( `Validation failed: ${messages.join( ', ' )}` )
        }

        routesActivationPayloads
            .forEach( ( { includeNamespaces, routePath, protocol, bearerToken, activationPayloads } ) => {
                this.#mcps[ routePath ] = { sessionIds: {}, activationPayloads }

                if( typeof bearerToken === 'string' && bearerToken !== '' ) {
                    this.#routeAuth[ routePath ] = bearerToken.toLowerCase()
                }

                this.#initRoute( { protocol, routePath } )
            } )

        this.#app.listen( finalPort, () => {
            if( !this.#silent ) {
                console.log( `\n🚀 Server is running on ${finalRootUrl}:${finalPort}` )
                console.log( '📜 Available Routes:' )

                routesActivationPayloads
                    .forEach( ( { routePath, protocol, bearerToken, activationPayloads } ) => {
                        const suffix = this.#config.suffixes[ protocol ] || ''
                        const tokenMsg = ( typeof bearerToken === 'string' && bearerToken !== '' )
                            ? `Authorization:  Bearer ${bearerToken}`
                            : 'Authorization:  '

                        const schemaCount = ( activationPayloads || [] ).length
                        const toolsCount = activationPayloads
                            .reduce( ( acc, { schema } ) => {
                                const count = Object.keys( schema.routes || {} ).length
                                return acc + count
                            }, 0 )
                        const n = activationPayloads
                            .map( ( { schema } ) => schema.namespace )
                            .filter( ( v, i, a ) => a.indexOf( v ) === i )

                        console.log( `- URL:            ${finalRootUrl}:${finalPort}${routePath}${suffix}` )
                        console.log( `  Transport Type: ${protocol}` )
                        console.log( `  ${tokenMsg}` )
                        console.log( `  Namespaces:     ${n.join( ', ' )}` )
                        console.log( `  Schemas:        ${schemaCount}, Tools: ${toolsCount}` )

                    } )
            }
        } )

        return { result: true }
    }


    #initRoute( { protocol, routePath } ) {
        const suffix = this.#config.suffixes[ protocol ] || '/sse'
        const fullPath = `${routePath}${suffix}`

        const authMiddleware = ( req, res, next ) => {
            const token = this.#routeAuth[ routePath ]

            if( !token ) { return next() }

            const auth = req.headers[ 'authorization' ]
            if( !auth || !auth.toLowerCase().startsWith( 'bearer ' ) || auth.split( ' ' )[ 1 ]?.toLowerCase() !== token ) {
                res
                    .status( 403 )
                    .json( { error: 'Forbidden: Invalid or missing bearer token' } )
            } else {
                next()
            }
        }

        if( protocol === 'sse' ) {
            const messagesPath = `${routePath}/post`

            this.#app.get( fullPath, authMiddleware, async ( req, res ) => {
                const server = new McpServer( this.#config.serverDescription )

                this.#mcps[ routePath ].activationPayloads
                    .forEach( ( { schema } ) => {
                        FlowMCP.activateServerTools( {
                            server,
                            schema,
                            serverParams: {},
                            activateTags: [],
                            silent: true
                        } )
                    } )

                const transport = new SSEServerTransport( messagesPath, res )
                const sessionId = transport._sessionId

                this.#mcps[ routePath ].sessionIds[ sessionId ] = {
                    server,
                    transport
                }

                if( !this.#silent ) {
                    console.log( `📱 Session created: ${sessionId}` )
                }

                this.#sendEvent( { channelName: 'sessionCreated', message: { protocol, routePath, sessionId } } )

                res.on( 'close', () => {
                    delete this.#mcps[ routePath ].sessionIds[ sessionId ]

                    if( !this.#silent ) {
                        console.log( `❌ Session closed: ${sessionId}` )
                    }

                    this.#sendEvent( { channelName: 'sessionClosed', message: { protocol, routePath, sessionId } } )
                } )

                await server.connect( transport )
            } )

            this.#app.post( messagesPath, authMiddleware, async ( req, res ) => {
                const { sessionId } = req.query
                const entry = this.#mcps[ routePath ].sessionIds[ sessionId ]

                if( !entry ) {
                    res
                        .status( 400 )
                        .send( 'Invalid sessionId' )

                    return
                }

                const method = req.body?.method || 'unknown'
                const toolName = req.body?.params?.name

                if( !this.#silent ) {
                    console.log( `⚙️ Tool called: method=${method}, toolName=${toolName}, sessionId=${sessionId}` )
                }

                this.#sendEvent( { channelName: 'callReceived', message: { protocol, routePath, sessionId, method, toolName } } )

                await entry.transport.handlePostMessage( req, res, req.body )
            } )
        }

        if( protocol === 'streamable' ) {
            this.#app.post( fullPath, authMiddleware, async ( req, res ) => {
                const server = new McpServer( this.#config.serverDescription )

                this.#mcps[ routePath ].activationPayloads
                    .forEach( ( { schema } ) => {
                        FlowMCP.activateServerTools( {
                            server,
                            schema,
                            serverParams: {},
                            activateTags: [],
                            silent: true
                        } )
                    } )

                const transport = new StreamableHTTPServerTransport( {} )

                const sessionId = 'stateless'

                this.#mcps[ routePath ].sessionIds[ sessionId ] = {
                    server,
                    transport
                }

                const method = req.body?.method || 'unknown'
                const toolName = req.body?.params?.name

                this.#sendEvent( { channelName: 'callReceived', message: { protocol, routePath, sessionId, method, toolName } } )

                await server.connect( transport )
                await transport.handleRequest( req, res, req.body )

                delete this.#mcps[ routePath ].sessionIds[ sessionId ]
            } )
        }

        return { result: true }
    }


    #bearerAuthMiddleware( req, res, next ) {
        next()
    }


    #sendEvent( { channelName, message } ) {
        this.#events.sendEvent( { channelName, message } )

        return true
    }


    static #validationStart( { routesActivationPayloads, rootUrl, port } ) {
        const struct = { status: false, messages: [] }

        if( routesActivationPayloads === undefined ) {
            struct[ 'messages' ].push( 'routesActivationPayloads: Is required' )
        } else if( !Array.isArray( routesActivationPayloads ) ) {
            struct[ 'messages' ].push( 'routesActivationPayloads: Must be an array' )
        }

        if( rootUrl !== undefined && typeof rootUrl !== 'string' ) {
            struct[ 'messages' ].push( 'rootUrl: Must be a string' )
        }

        if( port !== undefined && typeof port !== 'number' ) {
            struct[ 'messages' ].push( 'port: Must be a number' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        routesActivationPayloads
            .forEach( ( entry, index ) => {
                const { routePath, protocol, bearerToken, activationPayloads } = entry
                const specs = [
                    [ 'routePath', routePath, 'string', null ],
                    [ 'protocol', protocol, 'string', [ 'sse', 'streamable' ] ],
                    [ 'activationPayloads', activationPayloads, 'object', null ]
                ]

                specs
                    .forEach( ( [ key, value, type, list ] ) => {
                        if( value === undefined || value === null ) {
                            struct[ 'messages' ].push( `routesActivationPayloads[${index}].${key}: Is required` )
                        } else if( type === 'object' && !Array.isArray( value ) ) {
                            struct[ 'messages' ].push( `routesActivationPayloads[${index}].${key}: Must be an array` )
                        } else if( type === 'string' && typeof value !== 'string' ) {
                            struct[ 'messages' ].push( `routesActivationPayloads[${index}].${key}: Must be a string` )
                        } else if( type === 'string' && list !== null && !list.includes( value ) ) {
                            struct[ 'messages' ].push( `routesActivationPayloads[${index}].${key}: Invalid value "${value}". Allowed are ${list.join( ', ' )}` )
                        }
                    } )

                if( bearerToken !== null && typeof bearerToken !== 'string' ) {
                    struct[ 'messages' ].push( `routesActivationPayloads[${index}].bearerToken: Must be a string or null` )
                }
            } )

        struct[ 'status' ] = struct[ 'messages' ].length === 0

        return struct
    }
}


export { RemoteServer }
