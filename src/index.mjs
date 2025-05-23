import http from 'http'
import url from 'url'


class RemoteMcpServer {
    constructor( { port=3000 } ) {
        this.port = port
        this.routes = new Map()
        this.bearerToken = null
    }


    start() {
        const server = http.createServer( ( req, res ) => {
            if( !this.#isAuthenticated( req ) ) {
                res.writeHead( 401, { 'Content-Type': 'application/json' } )
                res.end( JSON.stringify( { error: 'Unauthorized' } ) )
                return
            }

            const parsedUrl = url.parse( req.url, true )
            const routeHandler = this.routes.get( parsedUrl.pathname )

            if( routeHandler ) {
                routeHandler( req, res )
            } else {
                res.writeHead( 404, { 'Content-Type': 'text/plain' } )
                res.end( '404 Not Found' )
            }
        } )

        server.listen( this.port, () => {
            console.log( `Server läuft auf http://localhost:${this.port}` )
        } )
    }


    addAuthentication( { bearerToken } ) {
        this.bearerToken = bearerToken
    }


    addRoute( { path, handler } ) {
        this.routes.set( path, handler )
    }


    #isAuthenticated( { req } ) {
        if( this.bearerToken === undefined ) { return true }
        const authHeader = req.headers['authorization']
        if( authHeader === undefined || !authHeader.startsWith('Bearer ') ) { return false }
        const token = authHeader.slice( 7 )
        return token === this.bearerToken
    }
}


export { RemoteMcpServer }
