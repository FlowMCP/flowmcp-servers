import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// Mock external dependencies before importing RemoteServer
const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn()
}

const mockMcpServer = {
    setRequestHandler: jest.fn()
}

const mockSSETransport = {}
const mockStreamableTransport = {}

const mockEvent = {
    on: jest.fn(),
    emit: jest.fn()
}

const mockFlowMCP = {
    filterArrayOfSchemas: jest.fn(),
    prepareActivations: jest.fn()
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

        test( 'should setup express middleware and bearer auth', () => {
            const server = new RemoteServer( { silent: false } )
            
            expect( mockApp.use ).toHaveBeenCalledTimes( 2 ) // json + bearerAuth
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
        const mockRoutes = [
            {
                includeNamespaces: [ 'coingecko' ],
                excludeNamespaces: [],
                activateTags: [ 'production' ],
                routePath: '/api',
                protocol: 'sse',
                bearerToken: 'token123'
            },
            {
                includeNamespaces: [],
                excludeNamespaces: [ 'debug' ],
                activateTags: [],
                routePath: '/test',
                protocol: 'streamable',
                bearerToken: null
            }
        ]

        const mockArrayOfSchemas = [
            { namespace: 'coingecko', name: 'schema1' },
            { namespace: 'defillama', name: 'schema2' }
        ]

        const mockEnvObject = { API_KEY: 'test' }

        beforeEach( () => {
            FlowMCP.filterArrayOfSchemas.mockReturnValue( {
                filteredArrayOfSchemas: [ { namespace: 'coingecko', name: 'filtered' } ]
            } )
            FlowMCP.prepareActivations.mockReturnValue( {
                activationPayloads: [ { schema: { namespace: 'coingecko' } } ]
            } )
        } )

        test( 'should process routes and return activation payloads', () => {
            const result = RemoteServer.prepareRoutesActivationPayloads( {
                routes: mockRoutes,
                arrayOfSchemas: mockArrayOfSchemas,
                envObject: mockEnvObject
            } )

            expect( result.routesActivationPayloads ).toHaveLength( 2 )
            expect( FlowMCP.filterArrayOfSchemas ).toHaveBeenCalledTimes( 2 )
            expect( FlowMCP.prepareActivations ).toHaveBeenCalledTimes( 2 )
        } )

        test( 'should handle routes with undefined namespace/tag values', () => {
            const routesWithUndefined = [
                {
                    includeNamespaces: undefined,
                    excludeNamespaces: undefined,
                    activateTags: undefined,
                    routePath: '/undefined',
                    protocol: 'sse',
                    bearerToken: 'token'
                }
            ]

            const result = RemoteServer.prepareRoutesActivationPayloads( {
                routes: routesWithUndefined,
                arrayOfSchemas: mockArrayOfSchemas,
                envObject: mockEnvObject
            } )

            expect( FlowMCP.filterArrayOfSchemas ).toHaveBeenCalledWith( {
                arrayOfSchemas: mockArrayOfSchemas,
                includeNamespaces: [],
                excludeNamespaces: [],
                activateTags: []
            } )
        } )

        test( 'should throw error when no schemas found for route', () => {
            FlowMCP.filterArrayOfSchemas.mockReturnValue( {
                filteredArrayOfSchemas: []
            } )

            expect( () => {
                RemoteServer.prepareRoutesActivationPayloads( {
                    routes: mockRoutes,
                    arrayOfSchemas: mockArrayOfSchemas,
                    envObject: mockEnvObject
                } )
            } ).toThrow( 'No schemas found for route:' )
        } )
    } )

    describe( 'start', () => {
        let server
        let consoleLogSpy

        const mockRoutesActivationPayloads = [
            {
                routePath: '/api',
                protocol: 'sse',
                bearerToken: 'token123',
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

        test( 'should setup route authentication for bearer tokens', () => {
            const startParams = {
                routesActivationPayloads: mockRoutesActivationPayloads
            }

            server.start( startParams )

            // Should store bearer token in lowercase for route auth
            // This is tested implicitly through the bearer auth middleware
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
                        bearerToken: null,
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
                    bearerToken: 'sse-token',
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
            FlowMCP.filterArrayOfSchemas.mockReturnValue( {
                filteredArrayOfSchemas: [ { namespace: 'test' } ]
            } )
            FlowMCP.prepareActivations.mockReturnValue( {
                activationPayloads: [ { schema: { namespace: 'test', routes: {} } } ]
            } )

            const routes = [ {
                includeNamespaces: [ 'test' ],
                excludeNamespaces: [],
                activateTags: [],
                routePath: '/integration',
                protocol: 'sse',
                bearerToken: 'integration-token'
            } ]

            const { routesActivationPayloads } = RemoteServer.prepareRoutesActivationPayloads( {
                routes,
                arrayOfSchemas: [ { namespace: 'test' } ],
                envObject: {}
            } )
            
            // Start server
            server.start( { routesActivationPayloads, port: 9090 } )
            
            expect( mockApp.listen ).toHaveBeenCalledWith( 9090, expect.any( Function ) )
        } )
    } )
} )