import { Parameters } from './../../src/index.mjs'
import { RemoteServer } from './../../src/index.mjs'
import { SchemaImporter } from 'schemaimporter'
import { FlowMCP } from 'flowmcp'


const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: true,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

const { filteredArrayOfSchemas } = FlowMCP
    .filterArrayOfSchemas( { 
        arrayOfSchemas, 
        includeNamespaces: [],
        excludeNamespaces: [],
        activateTags: [] 
    } )


const { argvs, envObject } = Parameters
    .getParameters( { 
        'argv': process.argv,
        'processEnv': process.env,
        'arrayOfSchemas': filteredArrayOfSchemas,
    } )

const { 
    activateTags,
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
        'arrayOfSchemas': filteredArrayOfSchemas,
        envObject
    } )

const remoteServer = new RemoteServer( { silent } )
remoteServer
    .setConfig( { 'overwrite': { rootUrl, port } } )
remoteServer
    .addActivationPayloads( { 
        activationPayloads,
        routePath,
        transportProtocols,
 
    } )
remoteServer.start()
console.log( 'Remote Server started successfully.' )