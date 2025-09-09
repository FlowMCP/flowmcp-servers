import { Parameters } from '../task/Parameters.mjs'
import { FlowMCP } from 'flowmcp'
import { LocalServer } from '../servers/LocalServer.mjs'
import { RemoteServer } from '../servers/RemoteServer.mjs'


class Deploy {
    static #serverClass


    static init( { argv, processEnv, arrayOfSchemas } ) {
        const { argvs, envObject } = Parameters
            .getParameters( { argv, processEnv, arrayOfSchemas } )
        const { serverType, activateTags, excludeNamespaces, includeNamespaces } = argvs
  
        const { filteredArrayOfSchemas } = FlowMCP
            .filterArrayOfSchemas( { 
                arrayOfSchemas, 
                includeNamespaces, 
                excludeNamespaces, 
                activateTags 
            } )

        const { activationPayloads } = FlowMCP
            .prepareActivations( { 
                'arrayOfSchemas': filteredArrayOfSchemas,
                envObject
            } )

        let app, mcps, events
        if( serverType === 'local' ) {
            const { app: _a, mcps: _m, events: _e } = Deploy.#localServer( { argvs, activationPayloads } )
            app = _a; mcps = _m; events = _e
        } else if( serverType === 'remote' ) {
            const { app: _a, mcps: _m, events: _e } = Deploy.#remoteServer( { argvs, arrayOfSchemas, envObject } )
            app = _a; mcps = _m; events = _e
        } else {
            throw new Error( `Unknown server type: ${serverType}` )
        }

        return { serverType, app, mcps, events, argvs  }
    }


    static async start() {
        const { type, server, routesActivationPayloads } = this.#serverClass
        if( type === 'local' ) {
            await server.start()
            !server.silent ? console.warn( 'Local Server started successfully.' ) : ''
        } else if( type === 'remote' ) {
            server.start( { routesActivationPayloads } )
            !server.silent ? console.log( 'Remote Server started successfully.' ) : ''
        } else {
            throw new Error( `Unknown server type: ${type}` )
        }

        return true
    }


    static async #localServer( { argvs, activationPayloads } ) {
        const { silent } = argvs
        !silent ? console.log( 'Starting Local Server...' ) : ''
        const localServer = new LocalServer( { silent } )
        localServer
            .addActivationPayloads( { activationPayloads } )
        this.#serverClass = { 'type': 'local', 'server': localServer }
        const app = localServer.getApp()
    
        return { app, mcps: null, events: null }
    }


    static #remoteServer( { argvs, arrayOfSchemas, envObject } ) {
        const { silent, transportProtocols, includeNamespaces, excludeNamespaces, activateTags, routePath } = argvs
        
        // Filter schemas for this single route
        const { filteredArrayOfSchemas } = FlowMCP
            .filterArrayOfSchemas( { 
                arrayOfSchemas, 
                includeNamespaces, 
                excludeNamespaces, 
                activateTags 
            } )

        const remoteServer = new RemoteServer( { silent } )
        const app = remoteServer.getApp()
        const mcps = remoteServer.getMcps()
        const events = remoteServer.getEvents()
        
        const arrayOfRoutes = transportProtocols
            .map( ( protocol ) => {
                return { routePath, protocol }
            } )

        const objectOfSchemaArrays = {
            [routePath]: filteredArrayOfSchemas
        }

        const { routesActivationPayloads } = RemoteServer
            .prepareRoutesActivationPayloads( { arrayOfRoutes, objectOfSchemaArrays, envObject } )
        
        this.#serverClass = { 'type': 'remote', 'server': remoteServer, 'routesActivationPayloads': routesActivationPayloads }

        return { app, mcps, events }
    }
}


export { Deploy }