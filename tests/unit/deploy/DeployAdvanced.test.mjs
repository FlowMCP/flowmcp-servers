import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// Mock external dependencies before importing DeployAdvanced
const mockRemoteServer = {
    getApp: jest.fn( () => 'advanced-app' ),
    getMcps: jest.fn( () => 'advanced-mcps' ),
    getEvents: jest.fn( () => 'advanced-events' ),
    start: jest.fn()
}

// Mock implementations
jest.unstable_mockModule( '../../../src/servers/RemoteServer.mjs', () => ( {
    RemoteServer: jest.fn( ( { silent = false } = {} ) => {
        mockRemoteServer.silent = silent
        return mockRemoteServer
    } )
} ) )

// Add static method mock for RemoteServer
const mockRemoteServerStatic = {
    prepareRoutesActivationPayloads: jest.fn()
}

// Import DeployAdvanced and mocked modules after setting up mocks
const { DeployAdvanced } = await import( '../../../src/deploy/Advanced.mjs' )
const { RemoteServer } = await import( '../../../src/servers/RemoteServer.mjs' )

// Add static method mock after import
Object.assign( RemoteServer, mockRemoteServerStatic )

describe( 'DeployAdvanced', () => {
    beforeEach( () => {
        jest.clearAllMocks()
        
        // Setup default mock implementations
        mockRemoteServerStatic.prepareRoutesActivationPayloads.mockReturnValue( {
            routesActivationPayloads: [ {
                routePath: '/advanced',
                protocol: 'sse',
                activationPayloads: [ { schema: { namespace: 'advanced-test' } } ]
            } ]
        } )
    } )

    describe( 'init', () => {
        test( 'should initialize with undefined silent parameter', () => {
            const result = DeployAdvanced.init( {} )

            expect( result.serverType ).toBe( 'multipleRoutes' )
            expect( result.app ).toBe( 'advanced-app' )
            expect( result.mcps ).toBe( 'advanced-mcps' )
            expect( result.events ).toBe( 'advanced-events' )
            expect( result.argvs ).toBe( null )
            expect( result.server ).toBe( mockRemoteServer )
            expect( RemoteServer ).toHaveBeenCalledWith( { silent: undefined } )
        } )

        test( 'should initialize with silent=true', () => {
            const result = DeployAdvanced.init( { silent: true } )

            expect( result.serverType ).toBe( 'multipleRoutes' )
            expect( result.app ).toBe( 'advanced-app' )
            expect( result.mcps ).toBe( 'advanced-mcps' )
            expect( result.events ).toBe( 'advanced-events' )
            expect( result.argvs ).toBe( null )
            expect( result.server ).toBe( mockRemoteServer )
            expect( RemoteServer ).toHaveBeenCalledWith( { silent: true } )
        } )

        test( 'should initialize with undefined parameters', () => {
            const result = DeployAdvanced.init( { silent: undefined } )

            expect( result.serverType ).toBe( 'multipleRoutes' )
            expect( RemoteServer ).toHaveBeenCalledWith( { silent: undefined } )
        } )

        test( 'should call all RemoteServer getter methods', () => {
            DeployAdvanced.init( { silent: true } )

            expect( mockRemoteServer.getApp ).toHaveBeenCalled()
            expect( mockRemoteServer.getMcps ).toHaveBeenCalled()
            expect( mockRemoteServer.getEvents ).toHaveBeenCalled()
        } )

        test( 'should return server instance for further manipulation', () => {
            const result = DeployAdvanced.init( { silent: false } )

            expect( result.server ).toBeDefined()
            expect( result.server ).toBe( mockRemoteServer )
        } )
    } )

    describe( 'start', () => {
        beforeEach( () => {
            // Initialize DeployAdvanced before each start test
            DeployAdvanced.init( { silent: true } )
        } )

        test( 'should prepare routes activation payloads and start server', () => {
            const arrayOfRoutes = [
                {
                    routePath: '/api/v1',
                    protocol: 'sse',
                }
            ]

            const objectOfSchemaArrays = {
                '/api/v1': [
                    { namespace: 'coingecko', name: 'price-api' }
                ]
            }

            const envObject = { API_KEY: 'test-key' }

            const result = DeployAdvanced.start( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject,
                rootUrl: 'https://api.example.com',
                port: 3000
            } )

            expect( result ).toBe( true )
            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalledWith( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject
            } )
            expect( mockRemoteServer.start ).toHaveBeenCalledWith( {
                routesActivationPayloads: [ {
                    routePath: '/advanced',
                    protocol: 'sse',
                    activationPayloads: [ { schema: { namespace: 'advanced-test' } } ]
                } ],
                rootUrl: 'https://api.example.com',
                port: 3000
            } )
        } )

        test( 'should start server without optional rootUrl and port', () => {
            const arrayOfRoutes = [
                {
                    routePath: '/minimal',
                    protocol: 'streamable',
                }
            ]

            const objectOfSchemaArrays = {
                '/minimal': [
                    { namespace: 'minimal', name: 'minimal-api' }
                ]
            }

            const result = DeployAdvanced.start( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject: {}
            } )

            expect( result ).toBe( true )
            expect( mockRemoteServer.start ).toHaveBeenCalledWith( {
                routesActivationPayloads: [ {
                    routePath: '/advanced',
                    protocol: 'sse',
                    activationPayloads: [ { schema: { namespace: 'advanced-test' } } ]
                } ],
                rootUrl: undefined,
                port: undefined
            } )
        } )

        test( 'should handle multiple routes with different protocols', () => {
            const arrayOfRoutes = [
                {
                    routePath: '/sse-endpoint',
                    protocol: 'sse',
                },
                {
                    routePath: '/streamable-endpoint',
                    protocol: 'streamable',
                }
            ]

            const objectOfSchemaArrays = {
                '/sse-endpoint': [
                    { namespace: 'coingecko', name: 'price-api' }
                ],
                '/streamable-endpoint': [
                    { namespace: 'defillama', name: 'tvl-api' }
                ]
            }

            const envObject = {
                COINGECKO_API_KEY: 'cg-key',
                DEFILLAMA_API_KEY: 'dl-key'
            }

            DeployAdvanced.start( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject,
                rootUrl: 'https://multi.example.com',
                port: 8080
            } )

            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalledWith( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject
            } )
        } )

        test( 'should handle empty routes array', () => {
            const result = DeployAdvanced.start( {
                arrayOfRoutes: [],
                objectOfSchemaArrays: {},
                envObject: {},
                rootUrl: 'https://empty.example.com',
                port: 9000
            } )

            expect( result ).toBe( true )
            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalledWith( {
                arrayOfRoutes: [],
                objectOfSchemaArrays: {},
                envObject: {}
            } )
        } )

        test( 'should pass through all parameters to server start', () => {
            const customRootUrl = 'https://custom.api.com'
            const customPort = 4000
            
            DeployAdvanced.start( {
                arrayOfRoutes: [ {
                    routePath: '/custom',
                    protocol: 'sse',
                } ],
                objectOfSchemaArrays: { 
                    '/custom': [ { namespace: 'custom' } ] 
                },
                envObject: { CUSTOM_KEY: 'custom-value' },
                rootUrl: customRootUrl,
                port: customPort
            } )

            expect( mockRemoteServer.start ).toHaveBeenCalledWith(
                expect.objectContaining( {
                    rootUrl: customRootUrl,
                    port: customPort
                } )
            )
        } )
    } )

    describe( 'integration workflow', () => {
        test( 'should handle complete DeployAdvanced workflow', () => {
            // Step 1: Initialize
            const initResult = DeployAdvanced.init( { silent: true } )

            expect( initResult.serverType ).toBe( 'multipleRoutes' )
            expect( initResult.server ).toBeDefined()

            // Step 2: Start with multiple routes
            const arrayOfRoutes = [
                {
                    routePath: '/production',
                    protocol: 'sse',
                },
                {
                    routePath: '/development',
                    protocol: 'streamable',
                }
            ]

            const objectOfSchemaArrays = {
                '/production': [
                    { namespace: 'coingecko', name: 'price-api' },
                    { namespace: 'defillama', name: 'tvl-api' }
                ],
                '/development': [
                    { namespace: 'development-tools', name: 'dev-api' }
                ]
            }

            const envObject = {
                API_KEY: 'integration-key',
                DEBUG_MODE: 'false'
            }

            const startResult = DeployAdvanced.start( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject,
                rootUrl: 'https://integration.api.com',
                port: 5000
            } )

            expect( startResult ).toBe( true )
            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalledWith( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject
            } )
            expect( mockRemoteServer.start ).toHaveBeenCalledWith( {
                routesActivationPayloads: [ {
                    routePath: '/advanced',
                    protocol: 'sse',
                    activationPayloads: [ { schema: { namespace: 'advanced-test' } } ]
                } ],
                rootUrl: 'https://integration.api.com',
                port: 5000
            } )
        } )

        test( 'should work with minimal configuration', () => {
            // Minimal init
            const initResult = DeployAdvanced.init( { silent: false } )
            expect( initResult ).toBeDefined()

            // Minimal start
            const startResult = DeployAdvanced.start( {
                arrayOfRoutes: [],
                objectOfSchemaArrays: {},
                envObject: {}
            } )

            expect( startResult ).toBe( true )
        } )
    } )

    describe( 'error scenarios', () => {
        test( 'should handle start without init', () => {
            // This tests the current behavior - DeployAdvanced doesn't validate init was called
            // Note: This might throw an error depending on implementation
            
            expect( () => {
                DeployAdvanced.start( {
                    arrayOfRoutes: [],
                    objectOfSchemaArrays: {},
                    envObject: {}
                } )
            } ).not.toThrow()
        } )
    } )
} )