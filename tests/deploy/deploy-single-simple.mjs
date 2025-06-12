import { SchemaImporter } from 'schemaimporter'
import { Deploy } from '../../src/index.mjs'


const arrayOfSchemas = await SchemaImporter
    .loadFromFolder( {
        excludeSchemasWithImports: true,
        excludeSchemasWithRequiredServerParams: true,
        addAdditionalMetaData: true,
        outputType: 'onlySchema'
    } )

const { serverType, app, mcps, events, argv } = Deploy
    .init( {
        'argv': process.argv,
        'processEnv': process.env,
        arrayOfSchemas
    } )

if( serverType === 'remote' ) {
    app.get( '/', ( req, res ) => { res.send( 'Welcome' ) } )
}

await Deploy.start()