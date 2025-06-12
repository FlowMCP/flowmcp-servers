import { RemoteServer } from '../servers/RemoteServer.mjs'
import { FlowMCP } from 'flowmcp'


class DeployAdvanced {
    static #server


    static init( { silent, arrayOfSchemas, serverConfig, envObject } ) {
        this.#validateInit( { silent, arrayOfSchemas, serverConfig, envObject } ) 

        const { routes, config } = serverConfig

        const { rootUrl, port } = config
        const remoteServer = new RemoteServer( { silent } )

        if( Object.keys( config ).length === 0 ) {
            remoteServer
                .setConfig( { 'overwrite': config } )
        }
        routes
            .map( ( route ) => {
                const { includeNamespaces, excludeNamespaces, activateTags } = route
                const { filteredArrayOfSchemas } = FlowMCP
                    .filterArrayOfSchemas( { 
                        arrayOfSchemas, 
                        includeNamespaces,
                        excludeNamespaces,
                        activateTags
                    } )
                if( filteredArrayOfSchemas.length === 0 ) {
                    throw new Error( `No schemas found for route: ${JSON.stringify( route )}` )
                }

                const { activationPayloads } = FlowMCP
                    .prepareActivations( { 
                        'arrayOfSchemas': filteredArrayOfSchemas,
                        envObject
                    } )

                route['activationPayloads'] = activationPayloads
                return route
            } )
            .forEach( ( { activationPayloads, routePath, transportProtocols, bearerToken } ) => {
                remoteServer
                    .addActivationPayloads( { activationPayloads, routePath, transportProtocols, bearerToken } )
            } )
        this.#server = remoteServer

        const app = remoteServer.getApp()
        const mcps = remoteServer.getMcps()
        const events = remoteServer.getEvents()

        return { serverType: 'multipleRoutes', app, mcps, events, argvs: null  }
    }


    static start() {
        this.#server.start()

        return true
    }


    static #validateInit( { silent, arrayOfSchemas, serverConfig, envObject } ) {
        const messages = []
        if( typeof silent !== 'boolean' ) {
            messages.push( 'silent must be a boolean.' )
        }

        if( !serverConfig || typeof serverConfig !== 'object' || serverConfig === null ) {
            messages.push( 'serverConfig must be a non-null object.' )
        } else if( !serverConfig.hasOwnProperty( 'routes' ) || !Array.isArray( serverConfig.routes ) || serverConfig.routes.length === 0 ) {
            messages.push( 'serverConfig must have a non-empty "routes" array.' )
        } else if( !serverConfig.hasOwnProperty( 'config' ) || typeof serverConfig.config !== 'object' || serverConfig.config === null ) {
            messages.push( 'serverConfig must have a "config" object.' )
        } 

        if( typeof envObject !== 'object' || envObject === null ) {
            messages.push( 'envObject must be an object.' )
        }

        if( messages.length > 0 ) {
            throw new Error( `MultipleRoutes.init validation failed:\n${messages.join( '\n' )}` )
        }

        const { routes, config } = serverConfig
        if( !Array.isArray( routes ) || routes.length === 0 ) {
            messages.push( 'routes must be a non-empty array.' )
        } else {
            routes
                .forEach( ( payload, index ) => {
                    const { name, routePath, bearerToken, transportProtocols, includeNamespaces, excludeNamespaces, activateTags } = payload
                    const n = [
                        // [ 'name',               name,               'string' ],
                        [ 'routePath',          routePath,          'string' ],
                        [ 'transportProtocols', transportProtocols, 'array'  ],
                        [ 'includeNamespaces',  includeNamespaces,  'array'  ],
                        [ 'excludeNamespaces',  excludeNamespaces,  'array'  ],
                        [ 'activateTags',       activateTags,       'array'  ]
                    ]
                        .forEach( ( [ key, value, type ] ) => {
                            if( type === 'array' ) {
                                if( !Array.isArray( value ) ) {
                                    messages.push( `routes[${index}].${key} must be an array.` )
                                }

                                return true
                            }


                            if( typeof value !== type ) {
                                messages.push( `routes[${index}].${key} must be a ${type}.` )
                            }
                        } )
                } )
        }

        if( typeof config !== 'object' || config === null ) {
            messages.push( 'config must be an object.' )
        }


        if( !Array.isArray( arrayOfSchemas ) || arrayOfSchemas.length === 0 ) {
            messages.push( 'arrayOfSchemas must be a non-empty array.' )
        }




        return true
    }
}


export { DeployAdvanced }