import { Parameters } from '../../../src/task/Parameters.mjs'
import fs from 'fs'
import { jest, describe, test, expect } from '@jest/globals'

jest.mock( 'fs' )

describe( 'Parameters', () => {
    describe( 'getArgvConfig', () => {
        test( 'should return default config for type "default"', () => {
            const config = Parameters.getArgvConfig( { type: 'default' } )
            
            expect( config ).toEqual( expect.arrayContaining( [
                [ '--includeNamespaces=', 'includeNamespaces', 'array', [] ],
                [ '--excludeNamespaces=', 'excludeNamespaces', 'array', [] ],
                [ '--activateTags=', 'activateTags', 'array', [] ],
                [ '--envType=', 'envType', 'string', 'file' ],
                [ '--envPath=', 'envPath', 'string', '.example.env' ],
                [ '--serverType=', 'serverType', 'string', 'remote' ]
            ] ) )
        } )

        test( 'should return local config for type "local"', () => {
            const config = Parameters.getArgvConfig( { type: 'local' } )
            
            expect( config ).toEqual( [] )
        } )

        test( 'should return remote config for type "remote"', () => {
            const config = Parameters.getArgvConfig( { type: 'remote' } )
            
            expect( config ).toEqual( expect.arrayContaining( [
                [ '--port=', 'port', 'number', 8080 ],
                [ '--rootUrl=', 'rootUrl', 'string', 'http://localhost' ],
                [ '--silent=', 'silent', 'boolean', false ],
                [ '--transportProtocols=', 'transportProtocols', 'array', [ 'sse', 'streamable' ] ],
                [ '--routePath=', 'routePath', 'string', '/flowmcp' ]
            ] ) )
        } )

        test( 'should throw error for unknown type', () => {
            expect( () => {
                Parameters.getArgvConfig( { type: 'unknown' } )
            } ).toThrow( 'Unknown type: unknown' )
        } )
    } )

    describe( 'namespace and tag filtering parameters', () => {
        test( 'should parse includeNamespaces from argv', () => {
            const argv = [ 'node', 'script.mjs', '--includeNamespaces=coingecko,defillama' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.includeNamespaces ).toEqual( [ 'coingecko', 'defillama' ] )
        } )

        test( 'should parse excludeNamespaces from argv', () => {
            const argv = [ 'node', 'script.mjs', '--excludeNamespaces=test,debug' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.excludeNamespaces ).toEqual( [ 'test', 'debug' ] )
        } )

        test( 'should parse activateTags from argv', () => {
            const argv = [ 'node', 'script.mjs', '--activateTags=production,stable' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.activateTags ).toEqual( [ 'production', 'stable' ] )
        } )

        test( 'should use empty arrays as defaults for namespace/tag parameters', () => {
            const argv = [ 'node', 'script.mjs' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.includeNamespaces ).toEqual( [] )
            expect( argvs.excludeNamespaces ).toEqual( [] )
            expect( argvs.activateTags ).toEqual( [] )
        } )

        test( 'should handle comma-separated values with empty strings', () => {
            const argv = [ 'node', 'script.mjs', '--includeNamespaces=coingecko,,defillama,' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.includeNamespaces ).toEqual( [ 'coingecko', 'defillama' ] )
        } )
    } )

    describe( 'server type parameters', () => {
        test( 'should parse serverType and corresponding server parameters', () => {
            const argv = [ 
                'node', 'script.mjs', 
                '--serverType=remote',
                '--port=3000',
                '--rootUrl=https://example.com'
            ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.serverType ).toBe( 'remote' )
            expect( argvs.port ).toBe( 3000 )
            expect( argvs.rootUrl ).toBe( 'https://example.com' )
        } )

        test( 'should use default values when parameters not provided', () => {
            const argv = [ 'node', 'script.mjs', '--serverType=remote' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.port ).toBe( 8080 )
            expect( argvs.rootUrl ).toBe( 'http://localhost' )
            expect( argvs.transportProtocols ).toEqual( [ 'sse', 'streamable' ] )
            expect( argvs.routePath ).toBe( '/flowmcp' )
        } )

        test( 'should parse transportProtocols array parameter', () => {
            const argv = [ 
                'node', 'script.mjs', 
                '--serverType=remote',
                '--transportProtocols=sse,websocket'
            ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.transportProtocols ).toEqual( [ 'sse', 'websocket' ] )
        } )
    } )

    describe( 'environment configuration', () => {
        test( 'should use file env type by default', () => {
            const argv = [ 'node', 'script.mjs' ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.envType ).toBe( 'file' )
            expect( argvs.envPath ).toBe( '.example.env' )
        } )

        test( 'should parse custom env parameters', () => {
            const argv = [ 
                'node', 'script.mjs',
                '--envType=processEnv',
                '--envPath=custom.env'
            ]
            const mockProcessEnv = {}
            const mockArrayOfSchemas = []

            fs.readFileSync = jest.fn().mockReturnValue( '' )

            const { argvs } = Parameters.getParameters( { argv, processEnv: mockProcessEnv, arrayOfSchemas: mockArrayOfSchemas } )
            
            expect( argvs.envType ).toBe( 'processEnv' )
            expect( argvs.envPath ).toBe( 'custom.env' )
        } )
    } )
} )