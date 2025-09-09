import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// Mock external dependencies before importing RemoteServer
const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn()
}

const mockMcpServer = {
    setRequestHandler: jest.fn(),
    connect: jest.fn()
}

const mockSSETransport = {
    _sessionId: 'mock-session-123',
    handlePostMessage: jest.fn()
}
const mockStreamableTransport = {
    handleRequest: jest.fn()
}

const mockEvent = {
    on: jest.fn(),
    emit: jest.fn(),
    sendEvent: jest.fn()
}

const mockFlowMCP = {
    filterArrayOfSchemas: jest.fn(),
    prepareActivations: jest.fn(),
    activateServerTools: jest.fn()
}

// Mock implementations
jest.unstable_mockModule( 'express', () => {
    const express = jest.fn( () => mockApp )
    express.json = jest.fn( () => 'json-middleware' )
    return { default: express }
} )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/mcp.js', () => ( {
    McpServer: jest.fn( () => mockMcpServer )
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/sse.js', () => ( {
    SSEServerTransport: jest.fn( () => mockSSETransport )
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/streamableHttp.js', () => ( {
    StreamableHTTPServerTransport: jest.fn( () => mockStreamableTransport )
} ) )

jest.unstable_mockModule( '../../../src/task/Event.mjs', () => ( {
    Event: jest.fn( () => mockEvent )
} ) )

jest.unstable_mockModule( 'flowmcp', () => ( {
    FlowMCP: mockFlowMCP
} ) )

// Import RemoteServer and mocked modules after setting up mocks
const { RemoteServer } = await import( '../../../src/servers/RemoteServer.mjs' )
const express = await import( 'express' )
const { McpServer } = await import( '@modelcontextprotocol/sdk/server/mcp.js' )
const { SSEServerTransport } = await import( '@modelcontextprotocol/sdk/server/sse.js' )
const { StreamableHTTPServerTransport } = await import( '@modelcontextprotocol/sdk/server/streamableHttp.js' )
const { Event } = await import( '../../../src/task/Event.mjs' )
const { FlowMCP } = await import( 'flowmcp' )

describe( 'RemoteServer', () => {
    beforeEach( () => {
        jest.clearAllMocks()
        
        // Reset mock implementations
        mockApp.listen.mockImplementation( ( port, callback ) => {
            if( callback ) callback()
        } )
    } )

    describe( 'constructor', () => {
        test( 'should create RemoteServer with default configuration', () => {
            const server = new RemoteServer( {} )
            
            expect( server ).toBeInstanceOf( RemoteServer )
            expect( express.default ).toHaveBeenCalled()
            expect( mockApp.use ).toHaveBeenCalledWith( 'json-middleware' )
            expect( Event ).toHaveBeenCalled()
        } )

        test( 'should create RemoteServer with silent=true', () => {
            const server = new RemoteServer( { silent: true } )
            
            expect( server ).toBeInstanceOf( RemoteServer )
        } )

        test( 'should setup express middleware', () => {
            const server = new RemoteServer( { silent: false } )
            
            expect( mockApp.use ).toHaveBeenCalledTimes( 1 ) // json only
        } )
    } )

    describe( 'setConfig', () => {
        let server

        beforeEach( () => {
            server = new RemoteServer( { silent: true } )
        } )

        test( 'should allow setting valid config keys', () => {
            const newConfig = {
                rootUrl: 'https://example.com',
                port: 3000,
                suffixes: { sse: '/custom-sse' }
            }

            expect( () => {
                server.setConfig( { overwrite: newConfig } )
            } ).not.toThrow()
        } )

        test( 'should throw error for invalid config keys', () => {
            const invalidConfig = {
                invalidKey: 'value',
                rootUrl: 'https://example.com'
            }

            expect( () => {
                server.setConfig( { overwrite: invalidConfig } )
            } ).toThrow( 'Invalid keys in config: invalidKey' )
        } )

        test( 'should handle multiple valid config updates', () => {
            server.setConfig( { overwrite: { port: 8080 } } )
            server.setConfig( { overwrite: { rootUrl: 'http://localhost' } } )
            
            // Should not throw
            expect( true ).toBe( true )
        } )
    } )

    describe( 'getters', () => {
        let server

        beforeEach( () => {
            server = new RemoteServer( { silent: true } )
        } )

        test( 'getApp should return express app', () => {
            const app = server.getApp()
            expect( app ).toBe( mockApp )
        } )

        test( 'getMcps should return mcps object', () => {
            const mcps = server.getMcps()
            expect( typeof mcps ).toBe( 'object' )
        } )

        test( 'getEvents should return events instance', () => {
            const events = server.getEvents()
            expect( events ).toBe( mockEvent )
        } )
    } )

    describe( 'prepareRoutesActivationPayloads', () => {
        const mockArrayOfRoutes = [
            {
                routePath: '/api',
                protocol: 'sse',
            },
            {
                routePath: '/test',
                protocol: 'streamable',
            }
        ]

        const mockObjectOfSchemaArrays = {
            '/api': [
                { namespace: 'coingecko', name: 'schema1' }
            ],
            '/test': [
                { namespace: 'defillama', name: 'schema2' }
            ]
        }

        const mockEnvObject = { API_KEY: 'test' }

        beforeEach( () => {
            FlowMCP.prepareActivations.mockReturnValue( {
                activationPayloads: [ { schema: { namespace: 'test' } } ]
            } )
        } )

        test( 'should process routes and return activation payloads', () => {
            const result = RemoteServer.prepareRoutesActivationPayloads( {
                arrayOfRoutes: mockArrayOfRoutes,
                objectOfSchemaArrays: mockObjectOfSchemaArrays,
                envObject: mockEnvObject
            } )

            expect( result.routesActivationPayloads ).toHaveLength( 2 )
            expect( FlowMCP.prepareActivations ).toHaveBeenCalledTimes( 2 )
            
            // Verify correct schemas were passed for each route
            expect( FlowMCP.prepareActivations ).toHaveBeenCalledWith( {
                arrayOfSchemas: [ { namespace: 'coingecko', name: 'schema1' } ],
                envObject: mockEnvObject
            } )
            expect( FlowMCP.prepareActivations ).toHaveBeenCalledWith( {
                arrayOfSchemas: [ { namespace: 'defillama', name: 'schema2' } ],
                envObject: mockEnvObject
            } )
        } )

        test( 'should handle single route correctly', () => {
            const singleRoute = [
                {
                    routePath: '/single',
                    protocol: 'sse',
                }
            ]

            const singleRouteSchemas = {
                '/single': [
                    { namespace: 'single', name: 'single-schema' }
                ]
            }

            const result = RemoteServer.prepareRoutesActivationPayloads( {
                arrayOfRoutes: singleRoute,
                objectOfSchemaArrays: singleRouteSchemas,
                envObject: mockEnvObject
            } )

            expect( result.routesActivationPayloads ).toHaveLength( 1 )
            expect( FlowMCP.prepareActivations ).toHaveBeenCalledWith( {
                arrayOfSchemas: [ { namespace: 'single', name: 'single-schema' } ],
                envObject: mockEnvObject
            } )
        } )

        test( 'should throw error when no schemas found for routePath', () => {
            const routesWithMissingSchemas = [
                {
                    routePath: '/missing',
                    protocol: 'sse',
                }
            ]

            const incompleteSchemaObject = {
                '/api': [ { namespace: 'existing' } ]
                // '/missing' is not defined
            }

            expect( () => {
                RemoteServer.prepareRoutesActivationPayloads( {
                    arrayOfRoutes: routesWithMissingSchemas,
                    objectOfSchemaArrays: incompleteSchemaObject,
                    envObject: mockEnvObject
                } )
            } ).toThrow( 'No schemas found for routePath: /missing' )
        } )

        test( 'should throw error when empty schema array for routePath', () => {
            const routesWithEmptySchemas = [
                {
                    routePath: '/empty',
                    protocol: 'sse',
                }
            ]

            const emptySchemaObject = {
                '/empty': []
            }

            expect( () => {
                RemoteServer.prepareRoutesActivationPayloads( {
                    arrayOfRoutes: routesWithEmptySchemas,
                    objectOfSchemaArrays: emptySchemaObject,
                    envObject: mockEnvObject
                } )
            } ).toThrow( 'No schemas found for routePath: /empty' )
        } )
    } )

    describe( 'start', () => {
        let server
        let consoleLogSpy

        const mockRoutesActivationPayloads = [
            {
                routePath: '/api',
                protocol: 'sse',
                activationPayloads: [
                    {
                        schema: {
                            namespace: 'coingecko',
                            routes: { tool1: {}, tool2: {} }
                        }
                    }
                ]
            }
        ]

        beforeEach( () => {
            server = new RemoteServer( { silent: true } )
            consoleLogSpy = jest.spyOn( console, 'log' ).mockImplementation( () => {} )
        } )

        afterEach( () => {
            if( consoleLogSpy ) {
                consoleLogSpy.mockRestore()
            }
        } )

        test( 'should start server with valid parameters', () => {
            const startParams = {
                routesActivationPayloads: mockRoutesActivationPayloads,
                rootUrl: 'http://localhost',
                port: 8080
            }

            expect( () => {
                server.start( startParams )
            } ).not.toThrow()

            expect( mockApp.listen ).toHaveBeenCalledWith( 8080, expect.any( Function ) )
        } )

        test( 'should use default rootUrl and port when not provided', () => {
            const startParams = {
                routesActivationPayloads: mockRoutesActivationPayloads
            }

            server.start( startParams )

            expect( mockApp.listen ).toHaveBeenCalledWith( 8080, expect.any( Function ) ) // default port
        } )


        test( 'should output server information when not silent', () => {
            const verboseServer = new RemoteServer( { silent: false } )
            const startParams = {
                routesActivationPayloads: mockRoutesActivationPayloads,
                rootUrl: 'http://localhost',
                port: 8080
            }

            verboseServer.start( startParams )

            expect( consoleLogSpy ).toHaveBeenCalledWith( expect.stringContaining( '🚀 Server is running on' ) )
            expect( consoleLogSpy ).toHaveBeenCalledWith( '📜 Available Routes:' )
        } )

        test( 'should handle empty activation payloads', () => {
            const startParams = {
                routesActivationPayloads: [
                    {
                        routePath: '/empty',
                        protocol: 'sse',
                        activationPayloads: []
                    }
                ]
            }

            expect( () => {
                server.start( startParams )
            } ).not.toThrow()
        } )

        test( 'should handle multiple routes with different protocols', () => {
            const multiRoutePayloads = [
                {
                    routePath: '/sse',
                    protocol: 'sse',
                    activationPayloads: mockRoutesActivationPayloads[ 0 ].activationPayloads
                },
                {
                    routePath: '/streamable',
                    protocol: 'streamable',
                    bearerToken: null,
                    activationPayloads: mockRoutesActivationPayloads[ 0 ].activationPayloads
                }
            ]

            const startParams = {
                routesActivationPayloads: multiRoutePayloads
            }

            expect( () => {
                server.start( startParams )
            } ).not.toThrow()
        } )
    } )

    describe( 'integration scenarios', () => {
        test( 'should handle full remote server workflow', () => {
            // Create server
            const server = new RemoteServer( { silent: true } )
            
            // Configure
            server.setConfig( { 
                overwrite: { 
                    port: 9090,
                    rootUrl: 'https://test.com'
                } 
            } )
            
            // Prepare routes
            FlowMCP.prepareActivations.mockReturnValue( {
                activationPayloads: [ { schema: { namespace: 'test', routes: {} } } ]
            } )

            const arrayOfRoutes = [ {
                routePath: '/integration',
                protocol: 'sse',
            } ]

            const objectOfSchemaArrays = {
                '/integration': [ { namespace: 'test' } ]
            }

            const { routesActivationPayloads } = RemoteServer.prepareRoutesActivationPayloads( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject: {}
            } )
            
            // Start server
            server.start( { routesActivationPayloads, port: 9090 } )
            
            expect( mockApp.listen ).toHaveBeenCalledWith( 9090, expect.any( Function ) )
        } )
    } )

    describe( 'HTTP Route Handlers', () => {
        let server
        let consoleLogSpy

        beforeEach( () => {
            server = new RemoteServer( { silent: true } )
            consoleLogSpy = jest.spyOn( console, 'log' ).mockImplementation( () => {} )
            
            // Reset all mocks
            jest.clearAllMocks()
            
            // Setup default FlowMCP mock
            FlowMCP.activateServerTools.mockImplementation( () => {} )
        } )

        afterEach( () => {
            if( consoleLogSpy ) {
                consoleLogSpy.mockRestore()
            }
        } )

        describe( 'SSE GET Route Handler', () => {
            const mockActivationPayloads = [
                {
                    schema: {
                        namespace: 'test-namespace',
                        routes: { tool1: {}, tool2: {} }
                    },
                    serverParams: { apiKey: 'test' }
                }
            ]

            const mockRoutesActivationPayloads = [
                {
                    routePath: '/api',
                    protocol: 'sse',
                    activationPayloads: mockActivationPayloads
                }
            ]

            test( 'should create McpServer and setup SSE transport for GET request', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                // Verify GET route was registered
                expect( mockApp.get ).toHaveBeenCalledWith( '/api/sse', expect.any( Function ) )

                // Get the GET handler function
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]

                // Mock response object with close event
                const mockRes = {
                    on: jest.fn()
                }
                const mockReq = {}

                // Execute the GET handler
                await getHandler( mockReq, mockRes )

                // Verify McpServer was created with server description
                expect( McpServer ).toHaveBeenCalledWith( expect.objectContaining( {
                    name: 'Remote Server',
                    description: 'A remote Model Context Protocol server',
                    version: '1.0.0'
                } ) )
                
                // Verify FlowMCP.activateServerTools was called
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: mockActivationPayloads[0].schema,
                    serverParams: mockActivationPayloads[0].serverParams,
                    activateTags: [],
                    silent: true
                } )

                // Verify SSEServerTransport was created
                expect( SSEServerTransport ).toHaveBeenCalledWith( '/api/post', mockRes )

                // Verify server.connect was called
                expect( mockMcpServer.connect ).toHaveBeenCalledWith( mockSSETransport )
            } )

            test( 'should store session in mcps and emit sessionCreated event', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockRes = { on: jest.fn() }
                const mockReq = {}

                // Mock the events.sendEvent to capture emitted events
                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                await getHandler( mockReq, mockRes )

                // Verify session was stored in mcps
                const mcps = server.getMcps()
                expect( mcps['/api'] ).toBeDefined()
                expect( mcps['/api'].sessionIds ).toBeDefined()
                expect( mcps['/api'].sessionIds['mock-session-123'] ).toEqual( {
                    server: expect.any( Object ),
                    transport: mockSSETransport
                } )

                // Verify sessionCreated event was emitted
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'sessionCreated',
                    message: {
                        protocol: 'sse',
                        routePath: '/api',
                        sessionId: 'mock-session-123'
                    }
                } )
            } )

            test( 'should setup close handler for session cleanup', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockRes = { on: jest.fn() }
                const mockReq = {}

                await getHandler( mockReq, mockRes )

                // Verify close event listener was registered
                expect( mockRes.on ).toHaveBeenCalledWith( 'close', expect.any( Function ) )

                // Get and execute the close handler
                const closeHandler = mockRes.on.mock.calls.find( call => call[0] === 'close' )[1]
                
                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                closeHandler()

                // Verify session was removed from mcps
                const mcps = server.getMcps()
                expect( mcps['/api'].sessionIds['mock-session-123'] ).toBeUndefined()

                // Verify sessionClosed event was emitted
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'sessionClosed',
                    message: {
                        protocol: 'sse',
                        routePath: '/api',
                        sessionId: 'mock-session-123'
                    }
                } )
            } )

            test( 'should handle multiple activation payloads', async () => {
                const multiplePayloads = [
                    {
                        schema: { namespace: 'ns1', routes: {} },
                        serverParams: { key1: 'value1' }
                    },
                    {
                        schema: { namespace: 'ns2', routes: {} },
                        serverParams: { key2: 'value2' }
                    }
                ]

                const routePayloads = [
                    {
                        routePath: '/multi',
                        protocol: 'sse',
                        activationPayloads: multiplePayloads
                    }
                ]

                server.start( { routesActivationPayloads: routePayloads } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/multi/sse' )[1]
                const mockRes = { on: jest.fn() }
                const mockReq = {}

                await getHandler( mockReq, mockRes )

                // Verify FlowMCP.activateServerTools was called for each payload
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledTimes( 2 )
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: multiplePayloads[0].schema,
                    serverParams: multiplePayloads[0].serverParams,
                    activateTags: [],
                    silent: true
                } )
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: multiplePayloads[1].schema,
                    serverParams: multiplePayloads[1].serverParams,
                    activateTags: [],
                    silent: true
                } )
            } )

            test( 'should log session creation when not silent', async () => {
                const verboseServer = new RemoteServer( { silent: false } )
                verboseServer.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockRes = { on: jest.fn() }
                const mockReq = {}

                await getHandler( mockReq, mockRes )

                expect( consoleLogSpy ).toHaveBeenCalledWith( '📱 Session created: mock-session-123' )
            } )

            test( 'should log session closure when not silent', async () => {
                const verboseServer = new RemoteServer( { silent: false } )
                verboseServer.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockRes = { on: jest.fn() }
                const mockReq = {}

                await getHandler( mockReq, mockRes )

                const closeHandler = mockRes.on.mock.calls.find( call => call[0] === 'close' )[1]
                closeHandler()

                expect( consoleLogSpy ).toHaveBeenCalledWith( '❌ Session closed: mock-session-123' )
            } )

            test( 'should handle missing serverParams gracefully', async () => {
                const payloadsWithoutServerParams = [
                    {
                        schema: { namespace: 'test', routes: {} }
                        // serverParams is missing
                    }
                ]

                const routePayloads = [
                    {
                        routePath: '/no-params',
                        protocol: 'sse',
                        activationPayloads: payloadsWithoutServerParams
                    }
                ]

                server.start( { routesActivationPayloads: routePayloads } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/no-params/sse' )[1]
                const mockRes = { on: jest.fn() }
                const mockReq = {}

                expect( async () => {
                    await getHandler( mockReq, mockRes )
                } ).not.toThrow()

                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: payloadsWithoutServerParams[0].schema,
                    serverParams: undefined,
                    activateTags: [],
                    silent: true
                } )
            } )
        } )

        describe( 'SSE POST Route Handler', () => {
            const mockActivationPayloads = [
                {
                    schema: { namespace: 'test', routes: {} },
                    serverParams: {}
                }
            ]

            const mockRoutesActivationPayloads = [
                {
                    routePath: '/api',
                    protocol: 'sse',
                    activationPayloads: mockActivationPayloads
                }
            ]

            test( 'should handle valid POST request with sessionId', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                // First simulate GET to create session
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockGetRes = { on: jest.fn() }
                await getHandler( {}, mockGetRes )

                // Now test POST handler
                expect( mockApp.post ).toHaveBeenCalledWith( '/api/post', expect.any( Function ) )
                
                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/api/post' )[1]

                const mockReq = {
                    query: { sessionId: 'mock-session-123' },
                    body: {
                        method: 'tools/call',
                        params: { name: 'test-tool' }
                    }
                }
                const mockRes = {}

                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                await postHandler( mockReq, mockRes )

                // Verify callReceived event was emitted
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'sse',
                        routePath: '/api',
                        sessionId: 'mock-session-123',
                        method: 'tools/call',
                        toolName: 'test-tool'
                    }
                } )

                // Verify transport.handlePostMessage was called
                expect( mockSSETransport.handlePostMessage ).toHaveBeenCalledWith( 
                    mockReq, 
                    mockRes, 
                    mockReq.body 
                )
            } )

            test( 'should return 400 for invalid sessionId', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/api/post' )[1]

                const mockReq = {
                    query: { sessionId: 'invalid-session-id' },
                    body: { method: 'test' }
                }
                
                const mockRes = {
                    status: jest.fn().mockReturnThis(),
                    send: jest.fn()
                }

                await postHandler( mockReq, mockRes )

                expect( mockRes.status ).toHaveBeenCalledWith( 400 )
                expect( mockRes.send ).toHaveBeenCalledWith( 'Invalid sessionId' )
            } )

            test( 'should handle missing method gracefully', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                // Create session first
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockGetRes = { on: jest.fn() }
                await getHandler( {}, mockGetRes )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/api/post' )[1]

                const mockReq = {
                    query: { sessionId: 'mock-session-123' },
                    body: {} // No method or params
                }
                const mockRes = {}

                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                await postHandler( mockReq, mockRes )

                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'sse',
                        routePath: '/api',
                        sessionId: 'mock-session-123',
                        method: 'unknown',
                        toolName: undefined
                    }
                } )
            } )

            test( 'should handle missing toolName gracefully', async () => {
                server.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                // Create session first
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockGetRes = { on: jest.fn() }
                await getHandler( {}, mockGetRes )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/api/post' )[1]

                const mockReq = {
                    query: { sessionId: 'mock-session-123' },
                    body: {
                        method: 'test-method',
                        params: {} // No name property
                    }
                }
                const mockRes = {}

                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                await postHandler( mockReq, mockRes )

                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'sse',
                        routePath: '/api',
                        sessionId: 'mock-session-123',
                        method: 'test-method',
                        toolName: undefined
                    }
                } )
            } )

            test( 'should log tool calls when not silent', async () => {
                const verboseServer = new RemoteServer( { silent: false } )
                verboseServer.start( { routesActivationPayloads: mockRoutesActivationPayloads } )

                // Create session first
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/api/sse' )[1]
                const mockGetRes = { on: jest.fn() }
                await getHandler( {}, mockGetRes )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/api/post' )[1]

                const mockReq = {
                    query: { sessionId: 'mock-session-123' },
                    body: {
                        method: 'tools/call',
                        params: { name: 'example-tool' }
                    }
                }
                const mockRes = {}

                await postHandler( mockReq, mockRes )

                expect( consoleLogSpy ).toHaveBeenCalledWith( 
                    '⚙️ Tool called: method=tools/call, toolName=example-tool, sessionId=mock-session-123' 
                )
            } )
        } )

        describe( 'Streamable POST Route Handler', () => {
            test( 'should handle streamable POST request with stateless server creation', async () => {
                const streamableRoutes = [
                    {
                        routePath: '/streamable',
                        protocol: 'streamable',
                        activationPayloads: [ { schema: { namespace: 'test' }, serverParams: { key: 'value' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: streamableRoutes } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/streamable/streamable' )[1]

                const mockReq = {
                    body: {
                        method: 'tools/call',
                        params: { name: 'test-tool' }
                    }
                }
                const mockRes = {}

                await postHandler( mockReq, mockRes )

                // Verify a new McpServer was created
                expect( McpServer ).toHaveBeenCalledWith( {
                    name: 'Remote Server',
                    description: 'A remote Model Context Protocol server',
                    version: '1.0.0'
                } )

                // Verify FlowMCP.activateServerTools was called
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: { namespace: 'test' },
                    serverParams: {},
                    activateTags: [],
                    silent: true
                } )

                // Verify callReceived event was emitted
                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'streamable',
                        routePath: '/streamable',
                        sessionId: 'stateless',
                        method: 'tools/call',
                        toolName: 'test-tool'
                    }
                } )
            } )

            test( 'should create StreamableHTTPServerTransport and connect server', async () => {
                const streamableRoutes = [
                    {
                        routePath: '/api',
                        protocol: 'streamable',
                        activationPayloads: [ { schema: { namespace: 'api' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: streamableRoutes } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/api/streamable' )[1]

                const mockReq = {
                    body: {
                        method: 'initialize',
                        params: {}
                    }
                }
                const mockRes = {}

                await postHandler( mockReq, mockRes )

                // Verify StreamableHTTPServerTransport was created
                expect( StreamableHTTPServerTransport ).toHaveBeenCalledWith( {} )

                // Verify server.connect was called with transport
                expect( mockMcpServer.connect ).toHaveBeenCalledWith( mockStreamableTransport )

                // Verify transport.handleRequest was called
                expect( mockStreamableTransport.handleRequest ).toHaveBeenCalledWith( 
                    mockReq, 
                    mockRes, 
                    mockReq.body 
                )
            } )

            test( 'should handle missing method and toolName gracefully', async () => {
                const streamableRoutes = [
                    {
                        routePath: '/minimal',
                        protocol: 'streamable',
                        activationPayloads: [ { schema: { namespace: 'minimal' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: streamableRoutes } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/minimal/streamable' )[1]

                const mockReq = {
                    body: {} // No method or params
                }
                const mockRes = {}

                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                await postHandler( mockReq, mockRes )

                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'streamable',
                        routePath: '/minimal',
                        sessionId: 'stateless',
                        method: 'unknown',
                        toolName: undefined
                    }
                } )
            } )

            test( 'should activate tools without serverParams (empty object)', async () => {
                const streamableRoutes = [
                    {
                        routePath: '/noparams',
                        protocol: 'streamable',
                        activationPayloads: [ 
                            { 
                                schema: { namespace: 'test-schema' },
                                serverParams: { originalParam: 'ignored' } // This should be ignored
                            } 
                        ]
                    }
                ]

                server.start( { routesActivationPayloads: streamableRoutes } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/noparams/streamable' )[1]

                const mockReq = {
                    body: {
                        method: 'test-method',
                        params: { name: 'test-tool' }
                    }
                }
                const mockRes = {}

                await postHandler( mockReq, mockRes )

                // Verify FlowMCP.activateServerTools was called with empty serverParams
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: { namespace: 'test-schema' },
                    serverParams: {}, // Should be empty, not the original serverParams
                    activateTags: [],
                    silent: true
                } )
            } )

            test( 'should handle multiple activation payloads in streamable request', async () => {
                const multiplePayloads = [
                    { schema: { namespace: 'first' }, serverParams: { a: 1 } },
                    { schema: { namespace: 'second' }, serverParams: { b: 2 } }
                ]

                const streamableRoutes = [
                    {
                        routePath: '/multi-streamable',
                        protocol: 'streamable',
                        activationPayloads: multiplePayloads
                    }
                ]

                server.start( { routesActivationPayloads: streamableRoutes } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/multi-streamable/streamable' )[1]

                const mockReq = {
                    body: {
                        method: 'tools/list',
                        params: {}
                    }
                }
                const mockRes = {}

                await postHandler( mockReq, mockRes )

                // Verify FlowMCP.activateServerTools was called for each payload
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledTimes( 2 )
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: multiplePayloads[0].schema,
                    serverParams: {}, // Empty, not original serverParams
                    activateTags: [],
                    silent: true
                } )
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: multiplePayloads[1].schema,
                    serverParams: {}, // Empty, not original serverParams
                    activateTags: [],
                    silent: true
                } )
            } )

            test( 'should use stateless sessionId and clean up after request', async () => {
                const streamableRoutes = [
                    {
                        routePath: '/cleanup-test',
                        protocol: 'streamable',
                        activationPayloads: [ { schema: { namespace: 'cleanup' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: streamableRoutes } )

                // Verify initial state - no stateless session
                const mcps = server.getMcps()
                expect( mcps['/cleanup-test'].sessionIds ).toEqual( {} )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/cleanup-test/streamable' )[1]

                const mockReq = {
                    body: {
                        method: 'ping',
                        params: { name: 'ping-tool' }
                    }
                }
                const mockRes = {}

                const sendEventSpy = jest.spyOn( server.getEvents(), 'sendEvent' )

                await postHandler( mockReq, mockRes )

                // Verify callReceived event used 'stateless' sessionId
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'streamable',
                        routePath: '/cleanup-test',
                        sessionId: 'stateless',
                        method: 'ping',
                        toolName: 'ping-tool'
                    }
                } )

                // Verify session was cleaned up after request (no stateless session remains)
                expect( mcps['/cleanup-test'].sessionIds ).toEqual( {} )
            } )
        } )

        describe( 'Event System (#sendEvent method)', () => {
            test( 'should correctly call events.sendEvent with channelName and message', async () => {
                const routes = [
                    {
                        routePath: '/event-test',
                        protocol: 'sse',
                        activationPayloads: [ { schema: { namespace: 'events' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: routes } )

                // Get events instance and spy on sendEvent method
                const events = server.getEvents()
                const sendEventSpy = jest.spyOn( events, 'sendEvent' )

                // Trigger SSE GET to create session (triggers sessionCreated event)
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/event-test/sse' )[1]
                const mockRes = { on: jest.fn() }
                
                await getHandler( {}, mockRes )

                // Verify #sendEvent called events.sendEvent with correct parameters
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'sessionCreated',
                    message: {
                        protocol: 'sse',
                        routePath: '/event-test',
                        sessionId: 'mock-session-123'
                    }
                } )

                // Trigger close event (triggers sessionClosed event)
                const closeHandler = mockRes.on.mock.calls.find( call => call[0] === 'close' )[1]
                closeHandler()

                // Verify second event emission
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'sessionClosed',
                    message: {
                        protocol: 'sse',
                        routePath: '/event-test',
                        sessionId: 'mock-session-123'
                    }
                } )

                expect( sendEventSpy ).toHaveBeenCalledTimes( 2 )
            } )

            test( 'should handle multiple event emissions from different routes', async () => {
                const multiRoutes = [
                    {
                        routePath: '/route1',
                        protocol: 'sse',
                        activationPayloads: [ { schema: { namespace: 'route1' } } ]
                    },
                    {
                        routePath: '/route2',
                        protocol: 'streamable',
                        activationPayloads: [ { schema: { namespace: 'route2' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: multiRoutes } )

                const events = server.getEvents()
                const sendEventSpy = jest.spyOn( events, 'sendEvent' )

                // Trigger event from first route (SSE)
                const sseGetHandler = mockApp.get.mock.calls.find( call => call[0] === '/route1/sse' )[1]
                const mockSseRes = { on: jest.fn() }
                await sseGetHandler( {}, mockSseRes )

                // Trigger event from second route (Streamable)
                const streamablePostHandler = mockApp.post.mock.calls.find( call => call[0] === '/route2/streamable' )[1]
                const mockStreamableReq = {
                    body: {
                        method: 'test-method',
                        params: { name: 'test-tool' }
                    }
                }
                await streamablePostHandler( mockStreamableReq, {} )

                // Verify events from both routes were emitted
                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'sessionCreated',
                    message: {
                        protocol: 'sse',
                        routePath: '/route1',
                        sessionId: 'mock-session-123'
                    }
                } )

                expect( sendEventSpy ).toHaveBeenCalledWith( {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'streamable',
                        routePath: '/route2',
                        sessionId: 'stateless',
                        method: 'test-method',
                        toolName: 'test-tool'
                    }
                } )

                expect( sendEventSpy ).toHaveBeenCalledTimes( 2 )
            } )

            test( 'should emit callReceived events with correct method and toolName variations', async () => {
                const routes = [
                    {
                        routePath: '/call-test',
                        protocol: 'sse',
                        activationPayloads: [ { schema: { namespace: 'call-test' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: routes } )

                // Create session first
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/call-test/sse' )[1]
                const mockGetRes = { on: jest.fn() }
                await getHandler( {}, mockGetRes )

                const events = server.getEvents()
                const sendEventSpy = jest.spyOn( events, 'sendEvent' )
                sendEventSpy.mockClear() // Clear the sessionCreated event

                // Test different POST request variations
                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/call-test/post' )[1]

                // Test 1: Normal method and toolName
                await postHandler( {
                    query: { sessionId: 'mock-session-123' },
                    body: {
                        method: 'tools/call',
                        params: { name: 'example-tool' }
                    }
                }, {} )

                // Test 2: Missing method (should default to 'unknown')
                await postHandler( {
                    query: { sessionId: 'mock-session-123' },
                    body: {
                        params: { name: 'another-tool' }
                    }
                }, {} )

                // Test 3: Missing toolName (should be undefined)
                await postHandler( {
                    query: { sessionId: 'mock-session-123' },
                    body: {
                        method: 'tools/list',
                        params: {}
                    }
                }, {} )

                // Verify all callReceived events were emitted correctly
                expect( sendEventSpy ).toHaveBeenNthCalledWith( 1, {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'sse',
                        routePath: '/call-test',
                        sessionId: 'mock-session-123',
                        method: 'tools/call',
                        toolName: 'example-tool'
                    }
                } )

                expect( sendEventSpy ).toHaveBeenNthCalledWith( 2, {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'sse',
                        routePath: '/call-test',
                        sessionId: 'mock-session-123',
                        method: 'unknown',
                        toolName: 'another-tool'
                    }
                } )

                expect( sendEventSpy ).toHaveBeenNthCalledWith( 3, {
                    channelName: 'callReceived',
                    message: {
                        protocol: 'sse',
                        routePath: '/call-test',
                        sessionId: 'mock-session-123',
                        method: 'tools/list',
                        toolName: undefined
                    }
                } )

                expect( sendEventSpy ).toHaveBeenCalledTimes( 3 )
            } )
        } )

        describe( 'Validation Edge Cases (#validationStart method)', () => {
            test( 'should throw error for invalid routesActivationPayloads array entries', () => {
                // Test invalid routePath
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: 123, // Should be string
                                protocol: 'sse',
                                activationPayloads: []
                            }
                        ]
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads[0].routePath: Must be a string' )

                // Test missing activationPayloads
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/test',
                                protocol: 'sse'
                                // missing activationPayloads
                            }
                        ]
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads[0].activationPayloads: Is required' )

                // Test invalid activationPayloads (not array)
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/test',
                                protocol: 'sse',
                                activationPayloads: "not-an-array" // Should be array
                            }
                        ]
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads[0].activationPayloads: Must be an array' )
            } )

            test( 'should throw error for invalid protocol values', () => {
                // Test invalid protocol (not in allowed list)
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/test',
                                protocol: 'http', // Should be 'sse' or 'streamable'
                                activationPayloads: []
                            }
                        ]
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads[0].protocol: Invalid value "http". Allowed are sse, streamable' )

                // Test protocol as number
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/test',
                                protocol: 456, // Should be string
                                activationPayloads: []
                            }
                        ]
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads[0].protocol: Must be a string' )

                // Test null protocol
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/test',
                                protocol: null, // Should be defined
                                activationPayloads: []
                            }
                        ]
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads[0].protocol: Is required' )
            } )

            test( 'should validate nested array entries with correct indexing', () => {
                // Test multiple entries with different validation errors
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/valid',
                                protocol: 'sse',
                                activationPayloads: []
                            },
                            {
                                routePath: null, // Error in second entry
                                protocol: 'streamable',
                                activationPayloads: []
                            },
                            {
                                routePath: '/also-valid',
                                protocol: 'invalid-protocol', // Error in third entry
                                activationPayloads: []
                            }
                        ]
                    } )
                } ).toThrow( /routesActivationPayloads\[1\]\.routePath: Is required.*routesActivationPayloads\[2\]\.protocol: Invalid value "invalid-protocol"/ )

                // Test that the first valid entry doesn't prevent detection of later errors
                const errorRegex = /routesActivationPayloads\[1\]/
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: '/first-valid',
                                protocol: 'sse', 
                                activationPayloads: []
                            },
                            {
                                routePath: '/second',
                                protocol: 'sse',
                                activationPayloads: "invalid" // Should be array
                            }
                        ]
                    } )
                } ).toThrow( errorRegex )
            } )

            test( 'should handle mixed validation scenarios with multiple parameter errors', () => {
                // Test top-level validation errors (early return prevents nested validation)
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: 789, // This won't be checked due to early return
                                protocol: 'websocket',
                                activationPayloads: {}
                            }
                        ],
                        rootUrl: 123, // Should be string
                        port: "8080" // Should be number
                    } )
                } ).toThrow( 'Validation failed: rootUrl: Must be a string, port: Must be a number' )

                // Test nested validation errors when top-level parameters are valid
                expect( () => {
                    server.start( {
                        routesActivationPayloads: [
                            {
                                routePath: 789, // Invalid type
                                protocol: 'websocket', // Invalid value
                                activationPayloads: {} // Invalid type
                            }
                        ],
                        rootUrl: "https://valid.com", // Valid
                        port: 3000 // Valid
                    } )
                } ).toThrow( /routesActivationPayloads\[0\]\.routePath: Must be a string.*routesActivationPayloads\[0\]\.protocol: Invalid value "websocket".*routesActivationPayloads\[0\]\.activationPayloads: Must be an array/ )

                // Test that undefined routesActivationPayloads is caught first
                expect( () => {
                    server.start( {
                        routesActivationPayloads: undefined,
                        rootUrl: 456, // This should not be processed due to early return
                        port: "invalid"
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads: Is required' )

                // Test that non-array routesActivationPayloads is caught
                expect( () => {
                    server.start( {
                        routesActivationPayloads: "not-an-array",
                        rootUrl: "valid-url",
                        port: 3000
                    } )
                } ).toThrow( 'Validation failed: routesActivationPayloads: Must be an array' )
            } )
        } )

        describe( 'Integration & Error Handling Tests', () => {
            test( 'should handle complex multi-route scenario with mixed protocols', async () => {
                const complexRoutes = [
                    {
                        routePath: '/sse-route',
                        protocol: 'sse',
                        activationPayloads: [
                            { schema: { namespace: 'sse1', routes: { 'tool1': {} } }, serverParams: { sse: true } },
                            { schema: { namespace: 'sse2', routes: { 'tool2': {} } }, serverParams: { env: 'prod' } }
                        ]
                    },
                    {
                        routePath: '/streamable-route',
                        protocol: 'streamable',
                        activationPayloads: [
                            { schema: { namespace: 'stream1', routes: { 'tool3': {} } }, serverParams: { stream: true } }
                        ]
                    },
                    {
                        routePath: '/another-sse',
                        protocol: 'sse',
                        activationPayloads: [
                            { schema: { namespace: 'sse3', routes: { 'tool4': {}, 'tool5': {} } }, serverParams: {} }
                        ]
                    }
                ]

                server.start( { routesActivationPayloads: complexRoutes } )

                // Verify all routes were registered correctly
                expect( mockApp.get ).toHaveBeenCalledWith( '/sse-route/sse', expect.any( Function ) )
                expect( mockApp.post ).toHaveBeenCalledWith( '/sse-route/post', expect.any( Function ) )
                expect( mockApp.post ).toHaveBeenCalledWith( '/streamable-route/streamable', expect.any( Function ) )
                expect( mockApp.get ).toHaveBeenCalledWith( '/another-sse/sse', expect.any( Function ) )
                expect( mockApp.post ).toHaveBeenCalledWith( '/another-sse/post', expect.any( Function ) )

                // Test SSE route functionality
                const sseGetHandler = mockApp.get.mock.calls.find( call => call[0] === '/sse-route/sse' )[1]
                const mockRes = { on: jest.fn() }
                await sseGetHandler( {}, mockRes )

                // Verify activation was called for both payloads
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: { namespace: 'sse1', routes: { 'tool1': {} } },
                    serverParams: { sse: true },
                    activateTags: [],
                    silent: true
                } )
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: { namespace: 'sse2', routes: { 'tool2': {} } },
                    serverParams: { env: 'prod' },
                    activateTags: [],
                    silent: true
                } )

                // Test streamable route functionality
                const streamableHandler = mockApp.post.mock.calls.find( call => call[0] === '/streamable-route/streamable' )[1]
                
                // Clear only FlowMCP mocks before streamable test
                FlowMCP.activateServerTools.mockClear()
                
                await streamableHandler( { body: { method: 'test' } }, {} )

                // Verify streamable activation (should use empty serverParams)
                expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                    server: expect.any( Object ),
                    schema: { namespace: 'stream1', routes: { 'tool3': {} } },
                    serverParams: {},
                    activateTags: [],
                    silent: true
                } )
            } )

            test( 'should handle FlowMCP.activateServerTools throwing errors gracefully', async () => {
                // Mock FlowMCP.activateServerTools to throw an error
                const originalActivateServerTools = FlowMCP.activateServerTools
                FlowMCP.activateServerTools.mockImplementation( () => {
                    throw new Error( 'FlowMCP activation failed' )
                } )

                const routes = [
                    {
                        routePath: '/error-test',
                        protocol: 'sse',
                        activationPayloads: [ { schema: { namespace: 'error' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: routes } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/error-test/sse' )[1]
                const mockRes = { on: jest.fn() }

                // The error should propagate up and cause the request to fail
                await expect( getHandler( {}, mockRes ) ).rejects.toThrow( 'FlowMCP activation failed' )

                // Restore original mock
                FlowMCP.activateServerTools = originalActivateServerTools
            } )

            test( 'should handle transport connection failures in SSE routes', async () => {
                // Mock server.connect to reject
                const mockServerConnect = mockMcpServer.connect.mockRejectedValueOnce( new Error( 'Connection failed' ) )

                const routes = [
                    {
                        routePath: '/connection-error',
                        protocol: 'sse',
                        activationPayloads: [ { schema: { namespace: 'connection-test' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: routes } )

                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/connection-error/sse' )[1]
                const mockRes = { on: jest.fn() }

                // Connection failure should propagate
                await expect( getHandler( {}, mockRes ) ).rejects.toThrow( 'Connection failed' )

                // Verify server.connect was called
                expect( mockServerConnect ).toHaveBeenCalledWith( mockSSETransport )
            } )

            test( 'should handle transport.handleRequest failures in streamable routes', async () => {
                // Mock transport.handleRequest to reject
                const mockHandleRequest = mockStreamableTransport.handleRequest.mockRejectedValueOnce( new Error( 'Request handling failed' ) )

                const routes = [
                    {
                        routePath: '/request-error',
                        protocol: 'streamable',
                        activationPayloads: [ { schema: { namespace: 'request-test' } } ]
                    }
                ]

                server.start( { routesActivationPayloads: routes } )

                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/request-error/streamable' )[1]

                const mockReq = {
                    body: {
                        method: 'test-method',
                        params: { name: 'test-tool' }
                    }
                }
                const mockRes = {}

                // Request handling failure should propagate
                await expect( postHandler( mockReq, mockRes ) ).rejects.toThrow( 'Request handling failed' )

                // Verify transport.handleRequest was called
                expect( mockHandleRequest ).toHaveBeenCalledWith( mockReq, mockRes, mockReq.body )
            } )

            test( 'should handle complete server lifecycle with proper cleanup', async () => {
                // Create unique session IDs for this test
                let sessionCounter = 0
                const originalSSETransport = SSEServerTransport
                SSEServerTransport.mockImplementation( () => {
                    sessionCounter++
                    return {
                        _sessionId: `lifecycle-session-${sessionCounter}`,
                        handlePostMessage: jest.fn()
                    }
                } )

                const lifecycleRoutes = [
                    {
                        routePath: '/lifecycle',
                        protocol: 'sse',
                        activationPayloads: [
                            { schema: { namespace: 'lifecycle-test', routes: { 'startup': {}, 'shutdown': {} } } }
                        ]
                    }
                ]

                // Start server
                server.start( { routesActivationPayloads: lifecycleRoutes } )

                // Create multiple sessions
                const getHandler = mockApp.get.mock.calls.find( call => call[0] === '/lifecycle/sse' )[1]
                
                const mockRes1 = { on: jest.fn() }
                const mockRes2 = { on: jest.fn() }
                const mockRes3 = { on: jest.fn() }

                await getHandler( {}, mockRes1 )
                await getHandler( {}, mockRes2 )
                await getHandler( {}, mockRes3 )

                // Verify sessions are tracked
                const mcps = server.getMcps()
                const sessionIds = Object.keys( mcps['/lifecycle'].sessionIds )
                expect( sessionIds ).toHaveLength( 3 )
                expect( sessionIds ).toContain( 'lifecycle-session-1' )
                expect( sessionIds ).toContain( 'lifecycle-session-2' )
                expect( sessionIds ).toContain( 'lifecycle-session-3' )

                // Test session activity via POST requests using the first session
                const postHandler = mockApp.post.mock.calls.find( call => call[0] === '/lifecycle/post' )[1]

                for( let i = 0; i < 3; i++ ) {
                    await postHandler( {
                        query: { sessionId: 'lifecycle-session-1' },
                        body: {
                            method: 'tools/call',
                            params: { name: `tool-${i}` }
                        }
                    }, {} )
                }

                // Verify events were emitted
                const events = server.getEvents()
                const sendEventSpy = jest.spyOn( events, 'sendEvent' )
                expect( sendEventSpy ).toHaveBeenCalledWith( expect.objectContaining( {
                    channelName: 'callReceived'
                } ) )

                // Close sessions to test cleanup
                const closeHandler1 = mockRes1.on.mock.calls.find( call => call[0] === 'close' )[1]
                const closeHandler2 = mockRes2.on.mock.calls.find( call => call[0] === 'close' )[1]

                closeHandler1()
                closeHandler2()

                // Verify partial cleanup (1 session should remain)
                const remainingSessions = Object.keys( mcps['/lifecycle'].sessionIds )
                expect( remainingSessions ).toHaveLength( 1 )
                expect( remainingSessions ).toContain( 'lifecycle-session-3' )

                // Close final session
                const closeHandler3 = mockRes3.on.mock.calls.find( call => call[0] === 'close' )[1]
                closeHandler3()

                // Verify complete cleanup
                const finalSessions = Object.keys( mcps['/lifecycle'].sessionIds )
                expect( finalSessions ).toHaveLength( 0 )

                // Verify sessionClosed events were emitted
                expect( sendEventSpy ).toHaveBeenCalledWith( expect.objectContaining( {
                    channelName: 'sessionClosed'
                } ) )

                // Restore original mock
                SSEServerTransport.mockImplementation( originalSSETransport )
            } )
        } )
    } )
} )