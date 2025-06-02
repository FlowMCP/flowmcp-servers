import { SchemaImporter } from 'schema-importer'
import { Deploy } from '../../src/index.mjs'


const schemaFilePaths = await SchemaImporter
    .get( { 
        'onlyWithoutImports': true,
        'withMetaData': true, 
        'withSchema': true 
    } )
const arrayOfSchemas = schemaFilePaths
    .map( ( { schema } ) => schema )

await Deploy.quick( {
    'argv': process.argv,
    'processEnv': process.env,
    arrayOfSchemas
} )