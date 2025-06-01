import { RemoteServer } from './src/index.mjs'
import { SchemaImporter } from 'schema-importer'
import { FlowMCP } from 'flowmcp'


const schemaFilePaths = await SchemaImporter
    .get( { 
        'onlyWithoutImports': true,
        'withMetaData': true, 
        'withSchema': true 
    } )
const arrayOfSchemas = schemaFilePaths
    .filter( ( { schema: { requiredServerParams } } ) => requiredServerParams.length === 0 )    
    .map( ( { schema } ) => schema )
const { activationPayloads } = FlowMCP
    .prepareActivations( { 
        arrayOfSchemas, 
        envObject: {}, 
        activateTags: [],
        includeNamespaces: [],
        excludeNamespaces: []
    } )

const remoteServer = new RemoteServer( { silent: true } )
remoteServer
    .addActivationPayloads( { 
        activationPayloads, 
        routePath: '/stateless', 
        transportProtocols: [ 'statelessStreamable' ] 
    } )
remoteServer.start()

