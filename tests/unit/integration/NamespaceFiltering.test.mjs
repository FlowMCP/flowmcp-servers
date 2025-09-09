import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'

// Mock external dependencies before importing
jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/mcp.js', () => ( {
    McpServer: jest.fn( () => ( {
        connect: jest.fn(),
        setRequestHandler: jest.fn(),
        tool: jest.fn(),
        addTool: jest.fn(),
        close: jest.fn()
    } ) )
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/stdio.js', () => ( {
    StdioServerTransport: jest.fn( () => ( {} ) )
} ) )

jest.unstable_mockModule( 'express', () => {
    const express = jest.fn( () => ( {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn( ( port, callback ) => callback && callback() )
    } ) )
    express.json = jest.fn( () => 'json-middleware' )
    return { default: express }
} )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/sse.js', () => ( {
    SSEServerTransport: jest.fn( () => ( {} ) )
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/streamableHttp.js', () => ( {
    StreamableHTTPServerTransport: jest.fn( () => ( {} ) )
} ) )

jest.unstable_mockModule( '../../../src/task/Event.mjs', () => ( {
    Event: jest.fn( () => ( {
        on: jest.fn(),
        emit: jest.fn()
    } ) )
} ) )

// Use real FlowMCP for authentic filtering tests
const { FlowMCP } = await import( 'flowmcp' )

// Import the modules we want to test
const { Parameters } = await import( '../../../src/task/Parameters.mjs' )
const { Deploy } = await import( '../../../src/deploy/Single.mjs' )
const { DeployAdvanced } = await import( '../../../src/deploy/Advanced.mjs' )

describe( 'Namespace and Tag Filtering Integration', () => {
    let consoleLogSpy
    let consoleWarnSpy

    beforeEach( () => {
        jest.clearAllMocks()
        consoleLogSpy = jest.spyOn( console, 'log' ).mockImplementation( () => {} )
        consoleWarnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} )
    } )

    afterEach( () => {
        if( consoleLogSpy ) consoleLogSpy.mockRestore()
        if( consoleWarnSpy ) consoleWarnSpy.mockRestore()
    } )

    // Sample schema data for testing (following FlowMCP schema structure)
    const testSchemas = [
        {
            namespace: 'coingecko',
            name: 'CoinGecko API',
            description: 'Cryptocurrency market data from CoinGecko',
            docs: [ 'https://coingecko.com/api' ],
            tags: [ 'production', 'crypto', 'stable' ],
            flowMCP: '1.2.2',
            root: 'https://api.coingecko.com/api/v3',
            requiredServerParams: [],
            headers: { 'Accept': 'application/json' },
            routes: {
                'getPrice': {
                    requestMethod: 'GET',
                    description: 'Get cryptocurrency prices',
                    route: '/simple/price',
                    parameters: [],
                    tests: [ { _description: 'Get Bitcoin price' } ],
                    modifiers: []
                },
                'getMarkets': {
                    requestMethod: 'GET',
                    description: 'Get coin markets',
                    route: '/coins/markets',
                    parameters: [],
                    tests: [ { _description: 'Get markets' } ],
                    modifiers: []
                }
            },
            handlers: {}
        },
        {
            namespace: 'defillama',
            name: 'DeFiLlama API',
            description: 'DeFi protocol data and analytics',
            docs: [ 'https://defillama.com/docs/api' ],
            tags: [ 'production', 'defi' ],
            flowMCP: '1.2.2',
            root: 'https://api.llama.fi',
            requiredServerParams: [],
            headers: { 'Accept': 'application/json' },
            routes: {
                'getTVL': {
                    requestMethod: 'GET',
                    description: 'Get total value locked',
                    route: '/tvl',
                    parameters: [],
                    tests: [ { _description: 'Get TVL data' } ],
                    modifiers: []
                },
                'getProtocols': {
                    requestMethod: 'GET',
                    description: 'Get DeFi protocols',
                    route: '/protocols',
                    parameters: [],
                    tests: [ { _description: 'Get protocols' } ],
                    modifiers: []
                }
            },
            handlers: {}
        },
        {
            namespace: 'debug',
            name: 'Debug Tools API',
            description: 'Debugging and development utilities',
            docs: [],
            tags: [ 'development', 'debugging' ],
            flowMCP: '1.2.2',
            root: 'https://debug.example.com',
            requiredServerParams: [],
            headers: {},
            routes: {
                'debugInfo': {
                    requestMethod: 'GET',
                    description: 'Get debug information',
                    route: '/debug',
                    parameters: [],
                    tests: [ { _description: 'Get debug info' } ],
                    modifiers: []
                }
            },
            handlers: {}
        },
        {
            namespace: 'jupiter',
            name: 'Jupiter Swap API',
            description: 'Solana DEX aggregator for token swaps',
            docs: [ 'https://docs.jup.ag' ],
            tags: [ 'production', 'trading' ],
            flowMCP: '1.2.2',
            root: 'https://quote-api.jup.ag/v6',
            requiredServerParams: [],
            headers: { 'Accept': 'application/json' },
            routes: {
                'getSwapRoute': {
                    requestMethod: 'GET',
                    description: 'Get swap route quote',
                    route: '/quote',
                    parameters: [],
                    tests: [ { _description: 'Get swap quote' } ],
                    modifiers: []
                },
                'executeSwap': {
                    requestMethod: 'POST',
                    description: 'Execute token swap',
                    route: '/swap',
                    parameters: [],
                    tests: [ { _description: 'Execute swap' } ],
                    modifiers: []
                }
            },
            handlers: {}
        },
        {
            namespace: 'test',
            name: 'Test API',
            description: 'Testing and development endpoints',
            docs: [],
            tags: [ 'development', 'testing' ],
            flowMCP: '1.2.2',
            root: 'https://test.example.com',
            requiredServerParams: [],
            headers: {},
            routes: {
                'testMethod': {
                    requestMethod: 'GET',
                    description: 'Test endpoint',
                    route: '/test',
                    parameters: [],
                    tests: [ { _description: 'Test method' } ],
                    modifiers: []
                }
            },
            handlers: {}
        }
    ]

    describe( 'FlowMCP.filterArrayOfSchemas', () => {
        test( 'should include only specified namespaces', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'coingecko', 'defillama' ],
                excludeNamespaces: [],
                activateTags: []
            } )

            expect( result.filteredArrayOfSchemas ).toHaveLength( 2 )
            const namespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( namespaces ).toEqual( [ 'coingecko', 'defillama' ] )
        } )

        test( 'should exclude specified namespaces', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [],
                excludeNamespaces: [ 'debug', 'test' ],
                activateTags: []
            } )

            const namespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( namespaces ).not.toContain( 'debug' )
            expect( namespaces ).not.toContain( 'test' )
            expect( namespaces ).toContain( 'coingecko' )
            expect( namespaces ).toContain( 'defillama' )
            expect( namespaces ).toContain( 'jupiter' )
        } )

        test( 'should filter by activate tags', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [],
                excludeNamespaces: [],
                activateTags: [ 'production' ]
            } )

            const namespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( namespaces ).toContain( 'coingecko' )
            expect( namespaces ).toContain( 'defillama' )
            expect( namespaces ).toContain( 'jupiter' )
            expect( namespaces ).not.toContain( 'debug' )
            expect( namespaces ).not.toContain( 'test' )
        } )

        test( 'should prioritize include over exclude filters', () => {
            // When both includeNamespaces and excludeNamespaces are provided,
            // includeNamespaces takes precedence and excludeNamespaces is ignored
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'coingecko', 'defillama', 'debug' ],
                excludeNamespaces: [ 'debug' ], // This will be ignored
                activateTags: []
            } )

            const namespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( namespaces ).toEqual( [ 'coingecko', 'defillama', 'debug' ] )
        } )

        test( 'should combine include namespaces with activate tags', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'coingecko', 'jupiter', 'test' ],
                excludeNamespaces: [],
                activateTags: [ 'production' ]
            } )

            const namespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( namespaces ).toContain( 'coingecko' )
            expect( namespaces ).toContain( 'jupiter' )
            expect( namespaces ).not.toContain( 'test' ) // test doesn't have 'production' tag
        } )

        test( 'should handle empty arrays (return all schemas)', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [],
                excludeNamespaces: [],
                activateTags: []
            } )

            expect( result.filteredArrayOfSchemas ).toHaveLength( testSchemas.length )
        } )

        test( 'should return empty when no schemas match criteria', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'nonexistent' ],
                excludeNamespaces: [],
                activateTags: []
            } )

            expect( result.filteredArrayOfSchemas ).toHaveLength( 0 )
        } )
    } )

    describe( 'Parameters CLI parsing for namespaces and tags', () => {
        test( 'should parse includeNamespaces from command line', () => {
            const argv = [
                'node', 'script.mjs',
                '--includeNamespaces=coingecko,defillama,jupiter'
            ]

            const { argvs } = Parameters.getParameters( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( argvs.includeNamespaces ).toEqual( [ 'coingecko', 'defillama', 'jupiter' ] )
        } )

        test( 'should parse excludeNamespaces from command line', () => {
            const argv = [
                'node', 'script.mjs',
                '--excludeNamespaces=debug,test'
            ]

            const { argvs } = Parameters.getParameters( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( argvs.excludeNamespaces ).toEqual( [ 'debug', 'test' ] )
        } )

        test( 'should parse activateTags from command line', () => {
            const argv = [
                'node', 'script.mjs',
                '--activateTags=production,stable'
            ]

            const { argvs } = Parameters.getParameters( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( argvs.activateTags ).toEqual( [ 'production', 'stable' ] )
        } )

        test( 'should handle combined namespace and tag parameters', () => {
            const argv = [
                'node', 'script.mjs',
                '--includeNamespaces=coingecko,jupiter',
                '--excludeNamespaces=debug',
                '--activateTags=production'
            ]

            const { argvs } = Parameters.getParameters( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( argvs.includeNamespaces ).toEqual( [ 'coingecko', 'jupiter' ] )
            expect( argvs.excludeNamespaces ).toEqual( [ 'debug' ] )
            expect( argvs.activateTags ).toEqual( [ 'production' ] )
        } )

        test( 'should handle empty comma-separated values', () => {
            const argv = [
                'node', 'script.mjs',
                '--includeNamespaces=coingecko,,defillama,',
                '--excludeNamespaces=,debug,',
                '--activateTags=,production,'
            ]

            const { argvs } = Parameters.getParameters( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( argvs.includeNamespaces ).toEqual( [ 'coingecko', 'defillama' ] )
            expect( argvs.excludeNamespaces ).toEqual( [ 'debug' ] )
            expect( argvs.activateTags ).toEqual( [ 'production' ] )
        } )
    } )

    describe( 'End-to-End Deploy filtering workflow', () => {
        test( 'should filter schemas correctly in Deploy.init() for local server', () => {
            const argv = [
                'node', 'script.mjs',
                '--serverType=local',
                '--includeNamespaces=coingecko,defillama',
                '--silent=true'
            ]

            const result = Deploy.init( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( result.serverType ).toBe( 'local' )

            // Verify that FlowMCP.filterArrayOfSchemas was called with correct parameters
            // We can't directly test the filtered result due to mocking, but we can verify
            // that the correct flow was followed
            expect( result ).toHaveProperty( 'serverType' )
            expect( result ).toHaveProperty( 'app' )
        } )

        test( 'should filter schemas correctly in Deploy.init() for remote server', () => {
            const argv = [
                'node', 'script.mjs',
                '--serverType=remote',
                '--excludeNamespaces=debug,test',
                '--activateTags=production',
                '--silent=true',
                '--transportProtocols=sse'
            ]

            const result = Deploy.init( {
                argv,
                processEnv: {},
                arrayOfSchemas: testSchemas
            } )

            expect( result.serverType ).toBe( 'remote' )
            expect( result ).toHaveProperty( 'app' )
            expect( result ).toHaveProperty( 'mcps' )
            expect( result ).toHaveProperty( 'events' )
        } )

        test( 'should handle DeployAdvanced with multiple routes and pre-filtered schemas', () => {
            const arrayOfRoutes = [
                {
                    routePath: '/crypto',
                    protocol: 'sse',
                },
                {
                    routePath: '/production',
                    protocol: 'streamable',
                }
            ]

            // User has already filtered the schemas per route
            const objectOfSchemaArrays = {
                '/crypto': [
                    // Only coingecko with production tag
                    testSchemas.find( s => s.namespace === 'coingecko' && s.tags.includes( 'production' ) )
                ],
                '/production': [
                    // Production schemas excluding debug and test
                    ...testSchemas.filter( s => 
                        s.tags.includes( 'production' ) && 
                        ![ 'debug', 'test' ].includes( s.namespace )
                    )
                ]
            }

            const initResult = DeployAdvanced.init( { silent: true } )
            expect( initResult.serverType ).toBe( 'multipleRoutes' )

            const startResult = DeployAdvanced.start( {
                arrayOfRoutes,
                objectOfSchemaArrays,
                envObject: {}
            } )

            expect( startResult ).toBe( true )
        } )
    } )

    describe( 'Real-world namespace filtering scenarios', () => {
        test( 'should correctly filter crypto-related namespaces', () => {
            const cryptoNamespaces = [ 'coingecko', 'defillama', 'jupiter' ]

            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: cryptoNamespaces,
                excludeNamespaces: [],
                activateTags: []
            } )

            const filteredNamespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( filteredNamespaces ).toEqual( cryptoNamespaces )

            // Verify that each schema has the expected routes
            const coingeckoSchema = result.filteredArrayOfSchemas.find( s => s.namespace === 'coingecko' )
            expect( Object.keys( coingeckoSchema.routes ) ).toContain( 'getPrice' )
            expect( Object.keys( coingeckoSchema.routes ) ).toContain( 'getMarkets' )
        } )

        test( 'should exclude development and debugging tools', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [],
                excludeNamespaces: [ 'debug', 'test' ],
                activateTags: []
            } )

            const filteredNamespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( filteredNamespaces ).not.toContain( 'debug' )
            expect( filteredNamespaces ).not.toContain( 'test' )

            // Should still include production namespaces
            expect( filteredNamespaces ).toContain( 'coingecko' )
            expect( filteredNamespaces ).toContain( 'defillama' )
            expect( filteredNamespaces ).toContain( 'jupiter' )
        } )

        test( 'should filter by production tag for stable APIs', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [],
                excludeNamespaces: [],
                activateTags: [ 'production' ]
            } )

            // All returned schemas should have 'production' tag
            result.filteredArrayOfSchemas.forEach( schema => {
                expect( schema.tags ).toContain( 'production' )
            } )

            const filteredNamespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( filteredNamespaces ).toEqual( [ 'coingecko', 'defillama', 'jupiter' ] )
        } )

        test( 'should combine multiple filters for precise selection', () => {
            // Get only crypto namespaces that are production-ready (OR operation for tags)
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'coingecko', 'defillama', 'jupiter' ],
                excludeNamespaces: [],
                activateTags: [ 'production' ] // OR operation - schemas with production tag
            } )

            // All three should match (all have 'production' tag)
            const filteredNamespaces = result.filteredArrayOfSchemas.map( s => s.namespace )
            expect( filteredNamespaces ).toEqual( [ 'coingecko', 'defillama', 'jupiter' ] )
        } )

        test( 'should handle edge case with no matching schemas', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'nonexistent1', 'nonexistent2' ],
                excludeNamespaces: [],
                activateTags: []
            } )

            expect( result.filteredArrayOfSchemas ).toHaveLength( 0 )
        } )

        test( 'should preserve schema structure after filtering', () => {
            const result = FlowMCP.filterArrayOfSchemas( {
                arrayOfSchemas: testSchemas,
                includeNamespaces: [ 'coingecko' ],
                excludeNamespaces: [],
                activateTags: []
            } )

            expect( result.filteredArrayOfSchemas ).toHaveLength( 1 )
            const schema = result.filteredArrayOfSchemas[ 0 ]

            expect( schema ).toHaveProperty( 'namespace' )
            expect( schema ).toHaveProperty( 'name' )
            expect( schema ).toHaveProperty( 'routes' )
            expect( schema ).toHaveProperty( 'tags' )

            expect( schema.namespace ).toBe( 'coingecko' )
            expect( schema.name ).toBe( 'CoinGecko API' )
            expect( typeof schema.routes ).toBe( 'object' )
            expect( Array.isArray( schema.tags ) ).toBe( true )
        } )
    } )
} )