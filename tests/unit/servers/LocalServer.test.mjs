import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// Mock external dependencies before importing LocalServer
const mockMcpServer = {
    connect: jest.fn()
}

const mockStdioServerTransport = {}

const mockFlowMCP = {
    activateServerTools: jest.fn()
}

// Mock implementations
jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/mcp.js', () => ( {
    McpServer: jest.fn( () => mockMcpServer )
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/server/stdio.js', () => ( {
    StdioServerTransport: jest.fn( () => mockStdioServerTransport )
} ) )

jest.unstable_mockModule( 'flowmcp', () => ( {
    FlowMCP: mockFlowMCP
} ) )

// Import LocalServer and mocked modules after setting up mocks
const { LocalServer } = await import( '../../../src/servers/LocalServer.mjs' )
const { McpServer } = await import( '@modelcontextprotocol/sdk/server/mcp.js' )
const { StdioServerTransport } = await import( '@modelcontextprotocol/sdk/server/stdio.js' )
const { FlowMCP } = await import( 'flowmcp' )

describe( 'LocalServer', () => {
    beforeEach( () => {
        jest.clearAllMocks()
    } )

    describe( 'constructor', () => {
        test( 'should create LocalServer with default silent=false', () => {
            const server = new LocalServer()
            
            expect( server ).toBeInstanceOf( LocalServer )
            expect( McpServer ).toHaveBeenCalledWith( {
                'name': 'Local Server',
                'description': 'A local Model Context Protocol server',
                'version': '1.2.2'
            } )
        } )

        test( 'should create LocalServer with silent=true', () => {
            const server = new LocalServer( { silent: true } )
            
            expect( server ).toBeInstanceOf( LocalServer )
        } )

        test( 'should create LocalServer with empty config object', () => {
            const server = new LocalServer( {} )
            
            expect( server ).toBeInstanceOf( LocalServer )
        } )
    } )

    describe( 'setConfig', () => {
        let server

        beforeEach( () => {
            server = new LocalServer()
        } )

        test( 'should allow setting serverDescription', () => {
            const newConfig = {
                serverDescription: {
                    name: 'Custom Server',
                    description: 'Custom description',
                    version: '2.0.0'
                }
            }

            const result = server.setConfig( { overwrite: newConfig } )
            
            expect( result ).toBe( true )
        } )

        test( 'should throw error for invalid config keys', () => {
            const invalidConfig = {
                invalidKey: 'value',
                serverDescription: { name: 'Test' }
            }

            expect( () => {
                server.setConfig( { overwrite: invalidConfig } )
            } ).toThrow( 'Invalid keys in config:' )
        } )

        test( 'should handle multiple valid keys', () => {
            const validConfig = {
                serverDescription: {
                    name: 'Multi Test',
                    version: '1.0.0'
                }
            }

            expect( () => {
                server.setConfig( { overwrite: validConfig } )
            } ).not.toThrow()
        } )
    } )

    describe( 'getApp', () => {
        test( 'should return the McpServer instance', () => {
            const server = new LocalServer()
            const app = server.getApp()
            
            expect( app ).toBe( mockMcpServer )
        } )
    } )

    describe( 'addActivationPayloads', () => {
        let server

        beforeEach( () => {
            server = new LocalServer( { silent: true } )
        } )

        test( 'should process single activation payload', () => {
            const activationPayloads = [
                {
                    serverParams: { param1: 'value1' },
                    schema: { name: 'test-schema' },
                    activateTags: [ 'tag1' ]
                }
            ]

            const result = server.addActivationPayloads( { activationPayloads } )

            expect( result ).toBe( true )
            expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( {
                server: mockMcpServer,
                schema: { name: 'test-schema' },
                serverParams: { param1: 'value1' },
                activateTags: [ 'tag1' ],
                silent: true
            } )
        } )

        test( 'should process multiple activation payloads', () => {
            const activationPayloads = [
                {
                    serverParams: { param1: 'value1' },
                    schema: { name: 'schema1' },
                    activateTags: [ 'tag1' ]
                },
                {
                    serverParams: { param2: 'value2' },
                    schema: { name: 'schema2' },
                    activateTags: [ 'tag2' ]
                }
            ]

            server.addActivationPayloads( { activationPayloads } )

            expect( FlowMCP.activateServerTools ).toHaveBeenCalledTimes( 2 )
            expect( FlowMCP.activateServerTools ).toHaveBeenNthCalledWith( 1, {
                server: mockMcpServer,
                schema: { name: 'schema1' },
                serverParams: { param1: 'value1' },
                activateTags: [ 'tag1' ],
                silent: true
            } )
            expect( FlowMCP.activateServerTools ).toHaveBeenNthCalledWith( 2, {
                server: mockMcpServer,
                schema: { name: 'schema2' },
                serverParams: { param2: 'value2' },
                activateTags: [ 'tag2' ],
                silent: true
            } )
        } )

        test( 'should handle empty activation payloads array', () => {
            const result = server.addActivationPayloads( { activationPayloads: [] } )

            expect( result ).toBe( true )
            expect( FlowMCP.activateServerTools ).not.toHaveBeenCalled()
        } )

        test( 'should use silent value from constructor', () => {
            const loudServer = new LocalServer( { silent: false } )
            const activationPayloads = [
                {
                    serverParams: {},
                    schema: { name: 'test' },
                    activateTags: []
                }
            ]

            loudServer.addActivationPayloads( { activationPayloads } )

            expect( FlowMCP.activateServerTools ).toHaveBeenCalledWith( 
                expect.objectContaining( { silent: false } )
            )
        } )
    } )

    describe( 'start', () => {
        let server

        beforeEach( () => {
            server = new LocalServer()
            mockMcpServer.connect.mockResolvedValue()
        } )

        test( 'should create transport and connect server successfully', async () => {
            await server.start()

            expect( StdioServerTransport ).toHaveBeenCalled()
            expect( mockMcpServer.connect ).toHaveBeenCalledWith( mockStdioServerTransport )
        } )

        test( 'should handle connection errors gracefully', async () => {
            const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation( () => {} )
            const connectionError = new Error( 'Connection failed' )
            mockMcpServer.connect.mockRejectedValue( connectionError )

            await server.start()

            expect( consoleErrorSpy ).toHaveBeenCalledWith( 'Failed to start server:', connectionError )
            
            consoleErrorSpy.mockRestore()
        } )
    } )

    describe( 'integration scenarios', () => {
        test( 'should complete full workflow: create, configure, add payloads, start', async () => {
            const server = new LocalServer( { silent: true } )
            
            // Configure
            server.setConfig( { 
                overwrite: { 
                    serverDescription: { 
                        name: 'Integration Test Server',
                        version: '1.0.0'
                    } 
                } 
            } )
            
            // Add payloads
            const activationPayloads = [ {
                serverParams: { test: true },
                schema: { name: 'integration-schema' },
                activateTags: [ 'integration' ]
            } ]
            server.addActivationPayloads( { activationPayloads } )
            
            // Start
            await server.start()
            
            expect( FlowMCP.activateServerTools ).toHaveBeenCalled()
            expect( mockMcpServer.connect ).toHaveBeenCalled()
        } )
    } )
} )