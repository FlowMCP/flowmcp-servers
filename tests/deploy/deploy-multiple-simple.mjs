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


const config = {
    'silent': false, // optional, default: false
    'envPath': './../../.env',
    'rootUrl': 'http://localhost', // optional
    'port': 8080, // optional
    'routes': [
        { 
            includeNamespaces: [ 'luksoNetwork' ],
            excludeNamespaces: [],
            activateTags: [],
            routePath: '/one',
            protocol: 'sse',
            bearerToken: null 
        },
        { 
            includeNamespaces: [ 'defillama' ],
            excludeNamespaces: [],
            activateTags: [],
            routePath: '/two',
            protocol: 'sse',
        }
    ]
}


const { envPath, routes, silent, rootUrl, port } = config
const { envObject } = getEnvObject( { envPath } )
const { serverType, app, mcps, events, argv, server } = DeployAdvanced
    .init( { silent } )
const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: false,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

app.get( '/', ( req, res ) => {
    res.send( `Test 123` )
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

DeployAdvanced
    .start( { routes, arrayOfSchemas, envObject, rootUrl, port } )
