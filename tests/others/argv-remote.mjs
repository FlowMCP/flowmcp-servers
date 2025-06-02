import { Parameters } from './../../src/index.mjs'
import { RemoteServer } from './../../src/index.mjs'
import { SchemaImporter } from 'schema-importer'
import { FlowMCP } from 'flowmcp'


const schemaFilePaths = await SchemaImporter
    .get( { 
        'onlyWithoutImports': true,
        'withMetaData': true, 
        'withSchema': true 
    } )
const arrayOfSchemas = schemaFilePaths
    .map( ( { schema } ) => schema )

const { argvs, envObject } = Parameters
    .getParameters( { 
        'argv': process.argv,
        'processEnv': process.env,
        arrayOfSchemas,
    } )

const { 
    activateTags,
    bearerToken,
    excludeNamespaces,
    includeNamespaces,
    routePath,
    rootUrl,
    port,
    silent,
    transportProtocols
} = argvs

if( !silent ) { 
    console.log( 'Argv Parameters:', argvs ) 
    console.log( 'Env Object:', envObject )
}

const { activationPayloads } = FlowMCP
    .prepareActivations( { 
        arrayOfSchemas,
        envObject,
        activateTags,
        includeNamespaces,
        excludeNamespaces 
    } )

const remoteServer = new RemoteServer( { silent } )
remoteServer
    .setConfig( { 'overwrite': { rootUrl, port } } )
remoteServer
    .addActivationPayloads( { 
        activationPayloads,
        routePath,
        transportProtocols,
        bearerToken 
    } )
remoteServer.start()
console.log( 'Remote Server started successfully.' )