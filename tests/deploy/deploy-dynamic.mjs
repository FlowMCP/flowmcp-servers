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

events
    .on( 'sessionCreated', ( { protocol, sessionId } ) => {
        console.log( `Session created: Protocol: ${protocol}, Session ID: ${sessionId}` )
        Object
            .entries( mcps[ protocol ]['sessionIds'][ sessionId ]['tools'] )
            .forEach( ( [ toolName, tool ], index ) => {
                if( index === 0 ) {
                    tool.update( { 'name': 'New Name', 'description': 'New Description' } )
                    return 
                }
                tool.disable()
            } )
        return true
    } )
    .on( 'callReceived', ( { protocol, sessionId, method, toolName } ) => {
        console.log( `Call: Protocol: ${protocol}, Session ID: ${sessionId}, method ${method}, toolName: ${toolName}` )
    } )
    .on( 'sessionClosed', ( { protocol, sessionId } ) => {
        console.log( `Session closed: Protocol: ${protocol}, Session ID: ${sessionId}` )
    } )

if( serverType === 'remote' ) {
    app.get( '/', ( req, res ) => { res.send( 'ABC' ) } )
}

await Deploy.start()