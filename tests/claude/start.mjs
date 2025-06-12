import { SchemaImporter } from 'schemaimporter'
import { Deploy } from '../../src/index.mjs'


const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: false,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

const { serverType, app, mcps, events, argv } = Deploy
    .init( {
        'argv': process.argv,
        'processEnv': process.env,
        arrayOfSchemas
    } )

await Deploy.start()