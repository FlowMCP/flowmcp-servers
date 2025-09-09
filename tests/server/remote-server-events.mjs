import fs from 'fs'
import { SchemaImporter } from 'schemaimporter'

import { FlowMCP } from 'flowmcp'
import { RemoteServer } from './../../src/index.mjs'


function getEnvObject( { source, envPath } ) {
    let envObject

    if( source === 'unknown' ) {
        envObject = fs
            .readFileSync( envPath, 'utf-8' )
            .split( '\n' )
            .reduce( ( acc, line ) => {
                const [ key, value ] = line.split( '=' )
                if( key && value ) { acc[ key.trim() ] = value.trim() }
                return acc
            }, {} )
    } else if( source === 'claude' ) {
        envObject = process.env
    } else { 
        console.log( 'Unknown source:', source ) 
    }

    return { envObject }
}


const config = {
    'silent': false,
    'envPath': './../../.env',
    'routes': [ { includeNamespaces: [], routePath: '/one', protocol: 'sse' } ]
}

const { silent, envPath, routes } = config
const { includeNamespaces, excludeNamespaces, activateTags, source } = FlowMCP
    .getArgvParameters( {
        'argv': process.argv,
        'includeNamespaces': [],
        'excludeNamespaces': [],
        'activateTags': [], 
    } )
const { envObject } = getEnvObject( { source, envPath } )

const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: true,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

const remoteServer = new RemoteServer( { silent } )
const events = remoteServer.getEvents()
events
    .on( 'sessionCreated', ( { protocol, sessionId } ) => {
        console.log( `Session created: Protocol: ${protocol}, Session ID: ${sessionId}` )
        return true
    } )
    .on( 'callReceived', ( { protocol, sessionId, method, toolName } ) => {
        console.log( `Call: Protocol: ${protocol}, Session ID: ${sessionId}, method ${method}, toolName: ${toolName}` )
    } )
    .on( 'sessionClosed', ( { protocol, sessionId } ) => {
        console.log( `Session closed: Protocol: ${protocol}, Session ID: ${sessionId}` )
    } )

const { routesActivationPayloads } = RemoteServer
    .prepareRoutesActivationPayloads( { routes, arrayOfSchemas, envObject } )
remoteServer
    .start( { routesActivationPayloads } )



