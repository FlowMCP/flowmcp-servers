import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// Mock external dependencies before importing Deploy
const mockLocalServer = {
    addActivationPayloads: jest.fn(),
    getApp: jest.fn( () => 'local-app' ),
    start: jest.fn(),
    silent: false
}

const mockRemoteServer = {
    getApp: jest.fn( () => 'remote-app' ),
    getMcps: jest.fn( () => 'remote-mcps' ),
    getEvents: jest.fn( () => 'remote-events' ),
    start: jest.fn(),
    silent: false
}

const mockParameters = {
    getParameters: jest.fn()
}

const mockFlowMCP = {
    filterArrayOfSchemas: jest.fn(),
    prepareActivations: jest.fn()
}

// Mock implementations
jest.unstable_mockModule( '../../../src/servers/LocalServer.mjs', () => ( {
    LocalServer: jest.fn().mockImplementation( ( { silent = false } = {} ) => {
        const instance = {
            addActivationPayloads: jest.fn(),
            getApp: jest.fn( () => 'local-app' ),
            start: jest.fn(),
            silent: silent
        }
        // Update the global mock reference for test assertions
        Object.assign( mockLocalServer, instance )
        return instance
    } )
} ) )

jest.unstable_mockModule( '../../../src/servers/RemoteServer.mjs', () => ( {
    RemoteServer: jest.fn( ( { silent = false } ) => {
        mockRemoteServer.silent = silent
        return mockRemoteServer
    } )
} ) )

jest.unstable_mockModule( '../../../src/task/Parameters.mjs', () => ( {
    Parameters: mockParameters
} ) )

jest.unstable_mockModule( 'flowmcp', () => ( {
    FlowMCP: mockFlowMCP
} ) )

// Import Deploy and mocked modules after setting up mocks
const { Deploy } = await import( '../../../src/deploy/Single.mjs' )
const { LocalServer } = await import( '../../../src/servers/LocalServer.mjs' )
const { RemoteServer } = await import( '../../../src/servers/RemoteServer.mjs' )
const { Parameters } = await import( '../../../src/task/Parameters.mjs' )
const { FlowMCP } = await import( 'flowmcp' )

// Add static method mocks for RemoteServer
RemoteServer.prepareRoutesActivationPayloads = jest.fn()

describe( 'Deploy', () => {
    beforeEach( () => {
        jest.clearAllMocks()
        
        // Note: Deploy's internal state is reset automatically between tests
        // because each test calls init() which sets up a new server instance
        
        // Setup default mock implementations
        mockParameters.getParameters.mockReturnValue( {
            argvs: {
                serverType: 'local',
                includeNamespaces: [],
                excludeNamespaces: [],
                activateTags: [],
                silent: false
            },
            envObject: {}
        } )
        
        mockFlowMCP.filterArrayOfSchemas.mockReturnValue( {
            filteredArrayOfSchemas: [ { namespace: 'test', name: 'test-schema' } ]
        } )
        
        mockFlowMCP.prepareActivations.mockReturnValue( {
            activationPayloads: [ { schema: { namespace: 'test' } } ]
        } )
        
        RemoteServer.prepareRoutesActivationPayloads.mockReturnValue( {
            routesActivationPayloads: [ { 
                routePath: '/test', 
                activationPayloads: [ { schema: { namespace: 'test' } } ] 
            } ]
        } )
    } )

    describe( 'init for local server', () => {
        test( 'should initialize local server with default parameters', () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'local',
                    includeNamespaces: [],
                    excludeNamespaces: [],
                    activateTags: [],
                    silent: false
                },
                envObject: {}
            } )

            const result = Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            expect( result.serverType ).toBe( 'local' )
            expect( LocalServer ).toHaveBeenCalledWith( { silent: false } )
            // Local server returns: { app, mcps: null, events: null }
            // For remote server: app/mcps/events are populated
            expect( typeof result ).toBe( 'object' )
            expect( result ).toHaveProperty( 'serverType' )
            expect( result ).toHaveProperty( 'app' )
            expect( result ).toHaveProperty( 'mcps' )
            expect( result ).toHaveProperty( 'events' )
        } )

        test( 'should handle namespace filtering for local server', () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'local',
                    includeNamespaces: [ 'coingecko' ],
                    excludeNamespaces: [ 'debug' ],
                    activateTags: [ 'production' ],
                    silent: true
                },
                envObject: { API_KEY: 'test' }
            } )

            const arrayOfSchemas = [ 
                { namespace: 'coingecko' }, 
                { namespace: 'debug' },
                { namespace: 'defillama' }
            ]

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas
            } )

            expect( FlowMCP.filterArrayOfSchemas ).toHaveBeenCalledWith( {
                arrayOfSchemas,
                includeNamespaces: [ 'coingecko' ],
                excludeNamespaces: [ 'debug' ],
                activateTags: [ 'production' ]
            } )

            expect( FlowMCP.prepareActivations ).toHaveBeenCalledWith( {
                arrayOfSchemas: [ { namespace: 'test', name: 'test-schema' } ],
                envObject: { API_KEY: 'test' }
            } )
        } )

        test( 'should call addActivationPayloads on local server', () => {
            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            expect( mockLocalServer.addActivationPayloads ).toHaveBeenCalledWith( {
                activationPayloads: [ { schema: { namespace: 'test' } } ]
            } )
        } )
    } )

    describe( 'init for remote server', () => {
        test( 'should initialize remote server with parameters', () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'remote',
                    includeNamespaces: [],
                    excludeNamespaces: [],
                    activateTags: [],
                    routePath: '/api',
                    transportProtocols: [ 'sse', 'streamable' ],
                    silent: false
                },
                envObject: {}
            } )

            const result = Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            expect( result.serverType ).toBe( 'remote' )
            expect( result.app ).toBe( 'remote-app' )
            expect( result.mcps ).toBe( 'remote-mcps' )
            expect( result.events ).toBe( 'remote-events' )
            expect( RemoteServer ).toHaveBeenCalledWith( { silent: false } )
        } )

        test( 'should prepare routes activation payloads for remote server', () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'remote',
                    includeNamespaces: [ 'coingecko' ],
                    excludeNamespaces: [],
                    activateTags: [ 'production' ],
                    routePath: '/api',
                    transportProtocols: [ 'sse' ],
                    silent: true
                },
                envObject: { API_KEY: 'test' }
            } )

            const arrayOfSchemas = [ { namespace: 'coingecko' } ]

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas
            } )

            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalledWith( {
                arrayOfRoutes: [ {
                    routePath: '/api',
                    protocol: 'sse'
                } ],
                objectOfSchemaArrays: {
                    '/api': [
                        { namespace: 'test', name: 'test-schema' }
                    ]
                },
                envObject: { API_KEY: 'test' }
            } )
        } )

        test( 'should handle multiple transport protocols', () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'remote',
                    includeNamespaces: [],
                    excludeNamespaces: [],
                    activateTags: [],
                    routePath: '/api',
                    transportProtocols: [ 'sse', 'streamable', 'websocket' ],
                    silent: false
                },
                envObject: {}
            } )

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalledWith( {
                arrayOfRoutes: [
                    { routePath: '/api', protocol: 'sse' },
                    { routePath: '/api', protocol: 'streamable' },
                    { routePath: '/api', protocol: 'websocket' }
                ],
                objectOfSchemaArrays: {
                    '/api': [ { namespace: 'test', name: 'test-schema' } ]
                },
                envObject: {}
            } )
        } )
    } )

    describe( 'init error handling', () => {
        test( 'should throw error for unknown server type', () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'unknown',
                    includeNamespaces: [],
                    excludeNamespaces: [],
                    activateTags: []
                },
                envObject: {}
            } )

            expect( () => {
                Deploy.init( {
                    argv: [ 'node', 'script.mjs' ],
                    processEnv: {},
                    arrayOfSchemas: []
                } )
            } ).toThrow( 'Unknown server type: unknown' )
        } )
    } )

    describe( 'start method', () => {
        test( 'should start local server correctly', async () => {
            // First init a local server
            mockParameters.getParameters.mockReturnValue( {
                argvs: { serverType: 'local', silent: false },
                envObject: {}
            } )

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            const consoleWarnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} )

            // Then start it
            const result = await Deploy.start()

            expect( result ).toBe( true )
            expect( mockLocalServer.start ).toHaveBeenCalled()
            expect( consoleWarnSpy ).toHaveBeenCalledWith( 'Local Server started successfully.' )

            consoleWarnSpy.mockRestore()
        } )

        test( 'should start remote server correctly', async () => {
            // First init a remote server
            mockParameters.getParameters.mockReturnValue( {
                argvs: { 
                    serverType: 'remote', 
                    silent: false,
                    transportProtocols: [ 'sse' ],
                    routePath: '/api',
                    bearerToken: 'token'
                },
                envObject: {}
            } )

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            const consoleLogSpy = jest.spyOn( console, 'log' ).mockImplementation( () => {} )

            // Then start it
            const result = await Deploy.start()

            expect( result ).toBe( true )
            expect( mockRemoteServer.start ).toHaveBeenCalledWith( {
                routesActivationPayloads: [ { 
                    routePath: '/test', 
                    activationPayloads: [ { schema: { namespace: 'test' } } ] 
                } ]
            } )
            expect( consoleLogSpy ).toHaveBeenCalledWith( 'Remote Server started successfully.' )

            consoleLogSpy.mockRestore()
        } )

        test( 'should handle silent mode for local server', async () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: { serverType: 'local', silent: true },
                envObject: {}
            } )

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            const consoleWarnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} )

            await Deploy.start()

            expect( consoleWarnSpy ).not.toHaveBeenCalled()
            consoleWarnSpy.mockRestore()
        } )

        test( 'should handle silent mode for remote server', async () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: { 
                    serverType: 'remote', 
                    silent: true,
                    transportProtocols: [ 'sse' ],
                    routePath: '/api'
                },
                envObject: {}
            } )

            Deploy.init( {
                argv: [ 'node', 'script.mjs' ],
                processEnv: {},
                arrayOfSchemas: [ { namespace: 'test' } ]
            } )

            const consoleLogSpy = jest.spyOn( console, 'log' ).mockImplementation( () => {} )

            await Deploy.start()

            expect( consoleLogSpy ).not.toHaveBeenCalled()
            consoleLogSpy.mockRestore()
        } )

        // Note: Currently Deploy.start() doesn't validate that init() was called first
        // This could be improved in the future for better error handling
    } )

    describe( 'integration workflow', () => {
        test( 'should handle complete local server workflow', async () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'local',
                    includeNamespaces: [ 'coingecko', 'defillama' ],
                    excludeNamespaces: [ 'debug' ],
                    activateTags: [ 'production', 'stable' ],
                    silent: true
                },
                envObject: { API_KEY: 'integration-test' }
            } )

            const arrayOfSchemas = [
                { namespace: 'coingecko', name: 'price-api' },
                { namespace: 'defillama', name: 'tvl-api' },
                { namespace: 'debug', name: 'debug-tools' }
            ]

            // Init
            const initResult = Deploy.init( {
                argv: [ 'node', 'script.mjs', '--serverType=local' ],
                processEnv: { NODE_ENV: 'test' },
                arrayOfSchemas
            } )

            expect( initResult.serverType ).toBe( 'local' )
            expect( FlowMCP.filterArrayOfSchemas ).toHaveBeenCalled()
            expect( FlowMCP.prepareActivations ).toHaveBeenCalled()
            expect( mockLocalServer.addActivationPayloads ).toHaveBeenCalled()

            // Start
            const startResult = await Deploy.start()

            expect( startResult ).toBe( true )
            expect( mockLocalServer.start ).toHaveBeenCalled()
        } )

        test( 'should handle complete remote server workflow', async () => {
            mockParameters.getParameters.mockReturnValue( {
                argvs: {
                    serverType: 'remote',
                    includeNamespaces: [],
                    excludeNamespaces: [],
                    activateTags: [],
                    routePath: '/flowmcp',
                    transportProtocols: [ 'sse', 'streamable' ],
                    silent: true
                },
                envObject: { SECRET_KEY: 'integration-secret' }
            } )

            const arrayOfSchemas = [
                { namespace: 'integration', name: 'test-schema' }
            ]

            // Init
            const initResult = Deploy.init( {
                argv: [ 'node', 'script.mjs', '--serverType=remote' ],
                processEnv: { NODE_ENV: 'production' },
                arrayOfSchemas
            } )

            expect( initResult.serverType ).toBe( 'remote' )
            expect( RemoteServer.prepareRoutesActivationPayloads ).toHaveBeenCalled()

            // Start
            const startResult = await Deploy.start()

            expect( startResult ).toBe( true )
            expect( mockRemoteServer.start ).toHaveBeenCalled()
        } )
    } )
} )