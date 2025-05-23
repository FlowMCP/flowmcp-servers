import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import express from 'express'
import { FlowMCP, Server } from 'flowmcp'
import { schema } from './../schemas/v1.2.0/poap/graphql.mjs'


const config = {
    'serverMetadata': {
        'name': 'Test',
        'description': 'This is a development server for testing purposes.',
        'version': '1.2.0',
    },
    'silent': false,
}

const schemas = [
    {
        schema,
        'serverParams': {},
        'activateTags': [],
    }
]


/*
function authenticate( req, res, next ) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith( 'Bearer ' ) ) {
        return res
            .status( 401 )
            .json( { error: 'Unauthorized - Missing or invalid token format' } )
    }
    
    const token = authHeader.split( ' ' )[ 1 ]
    
    if( token !== apiToken ) {
        return res
            .status( 401 )
            .json( { error: 'Unauthorized - Invalid token' } )
    }
    next()
}
*/


const app = express()
const PORT = 8080

app.use( express.json() )



const { serverMetadata, silent } = config
const server = new McpServer( serverMetadata )
schemas
    .forEach(( { serverParams, schema, activateTags } ) => {
        FlowMCP.activateServerTools( { server, schema, serverParams, activateTags, silent } )
    } )

app.get( '/sse', /*authenticate,*/ (req, res) => {
    res.setHeader( 'Content-Type', 'text/event-stream' )
    res.setHeader( 'Cache-Control', 'no-cache' )
    res.setHeader( 'Connection', 'keep-alive' )

    res.write( `data: ${JSON.stringify( { 'message': 'Connected to SSE endpoint' } ) }\n\n` )

    const clientId = Date.now()
    const newClient = { id: clientId, response: res }
    server.clients = server.clients || new Map()
    server.clients.set( clientId, newClient )
    
    console.log( `Client ${clientId} connected` )
    
    req.on( 'close', () => {
        server.clients.delete(clientId)
        console.log(`Client ${clientId} disconnected`)
    })
} )
    

server.broadcast = ( message ) => {
    if( !server.clients ) { return }
    
    server.clients
        .forEach( ( { response } ) => {
            response.write(`data: ${JSON.stringify(message)}\n\n`)
        } )
}


app.get( '/health', ( req, res ) => {
    res.json( { 'status': 'OK', 'version': config.version } )
} )


app.listen( PORT, () => {
    console.log( `Server running on port ${PORT}` )
    console.log( `SSE endpoint available at http://localhost:${PORT}/sse` )
})