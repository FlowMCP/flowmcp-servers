import { SchemaImporter } from 'schemaimporter'
import { DeployAdvanced } from '../../src/index.mjs'
import fs from 'fs'


function getEnvObject( { envPath } ) {
    let envObject = fs
        .readFileSync( envPath, 'utf-8' )
        .split( '\n' )
        .reduce( ( acc, line ) => {
            const [ key, value ] = line.split( '=' )
            if( key && value ) { acc[ key.trim() ] = value.trim() }
            return acc
        }, {} )

    return { envObject }
}


const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: false,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

const serverConfig = {
    'config': {},
    'routes': [
        {
            'routePath': '/luksoNetwork',
            'bearerToken': '1234',
            'transportProtocols': [ 'sse' ],
            'includeNamespaces': [ 'luksoNetwork' ],
            'excludeNamespaces': [],
            'activateTags': [],
        },
        {
            'routePath': '/defillama',
            'bearerToken': '1234',
            'transportProtocols': [ 'sse' ],
            'includeNamespaces': [ 'defillama' ],
            'excludeNamespaces': [],
            'activateTags': [],
        }
    ]
}


const { envObject } = getEnvObject( {  
    envPath: './../../.env'
} )

const { serverType, app, mcps, events, argv } = DeployAdvanced
    .init( { 
        'silent': false, 
        // arrayOfSchemas, 
        serverConfig,
        // envObject
    } )

DeployAdvanced
    .addRoutes( {
        serverConfig,
        arrayOfSchemas,
        envObject
    } )

events
    .on( 'sessionCreated', ( { protocol, routePath, sessionId } ) => {
        console.log( `Session created: Protocol: ${protocol}, Route Path: ${routePath}, Session ID: ${sessionId}` )
        return true
    } )
    .on( 'sessionClosed', ( { protocol, routePath, sessionId } ) => {
        console.log( `Session closed: Protocol: ${protocol}, Route Path: ${routePath}, Session ID: ${sessionId}` )
        return true
    } )


DeployAdvanced.start()
