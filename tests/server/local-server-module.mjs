import fs from 'fs'

import { FlowMCP } from 'flowmcp'
import { SchemaImporter } from 'schemaimporter'

import { LocalServer } from './../../src/index.mjs'


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

console.log( 'Starting Local Server...' )
const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: false,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

const { includeNamespaces, excludeNamespaces, activateTags, source } = FlowMCP
    .getArgvParameters( {
        'argv': process.argv,
        'includeNamespaces': [],
        'excludeNamespaces': [],
        'activateTags': [], 
    } )
const { envObject } = getEnvObject( { 
    source,
    envPath: './../../.env'
} )

const { filteredArrayOfSchemas } = FlowMCP
    .filterArrayOfSchemas( { 
        arrayOfSchemas, 
        includeNamespaces, 
        excludeNamespaces, 
        activateTags 
    } )

const { activationPayloads } = FlowMCP
    .prepareActivations( { 
        'arrayOfSchemas': filteredArrayOfSchemas, 
        envObject
    } )

const localServer = new LocalServer( { silent: true } )
localServer
    .addActivationPayloads( { activationPayloads } )
await localServer.start()
console.log( 'Local Server started successfully.' )
