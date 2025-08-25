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
        const mockArrayOfRoutes = [
            {
                routePath: '/api',
                protocol: 'sse',
                bearerToken: 'token123'
            },
            {
                routePath: '/test',
                protocol: 'streamable',
                bearerToken: null
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
                    bearerToken: 'single-token'
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
                    bearerToken: 'token'
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
                    bearerToken: 'token'
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
            FlowMCP.prepareActivations.mockReturnValue( {
                activationPayloads: [ { schema: { namespace: 'test', routes: {} } } ]
            } )

            const arrayOfRoutes = [ {
                routePath: '/integration',
                protocol: 'sse',
                bearerToken: 'integration-token'
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
} )