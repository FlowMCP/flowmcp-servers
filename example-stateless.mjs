import { RemoteServer } from './src/index.mjs'
import { SchemaImporter } from 'schemaimporter'
import { FlowMCP } from 'flowmcp'


const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: true,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

// Define routes with their configuration
const arrayOfRoutes = [
    {
        routePath: '/stateless',
        protocol: 'streamable'
    }
]

// Pre-assign schemas to routes
const objectOfSchemaArrays = {
    '/stateless': arrayOfSchemas
}

const remoteServer = new RemoteServer( { silent: true } )

// Prepare route activation payloads
const { routesActivationPayloads } = RemoteServer.prepareRoutesActivationPayloads( {
    arrayOfRoutes,
    objectOfSchemaArrays,
    envObject: {}
} )

remoteServer.start( { routesActivationPayloads } )

