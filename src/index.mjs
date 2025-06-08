import { LocalServer } from './servers/LocalServer.mjs'
import { RemoteServer } from './servers/RemoteServer.mjs'
import { Parameters } from './task/Parameters.mjs'
import { FlowMCP } from 'flowmcp'


class Deploy {
    static #serverClass


    static init( { argv, processEnv, arrayOfSchemas } ) {
        const { argvs, envObject } = Parameters
            .getParameters( { argv,processEnv,arrayOfSchemas } )
        const { serverType, activateTags, excludeNamespaces, includeNamespaces } = argvs
        const { activationPayloads } = FlowMCP
            .prepareActivations( { 
                arrayOfSchemas,
                envObject,
                activateTags,
                includeNamespaces,
                excludeNamespaces 
            } )

        let app, mcps, events
        if( serverType === 'local' ) {
            const { app: _a, mcps: _m, events: _e } = Deploy.#localServer( { argvs, activationPayloads } )
            app = _a; mcps = _m; events = _e
        } else if( serverType === 'remote' ) {
            const { app: _a, mcps: _m, events: _e } = Deploy.#remoteServer( { argvs, activationPayloads } )
            app = _a; mcps = _m; events = _e
        } else {
            throw new Error( `Unknown server type: ${serverType}` )
        }

        return { serverType, app, mcps, events, argvs  }
    }


    static async start() {
        const { type, server } = this.#serverClass
        if( type === 'local' ) {
            await server.start()
            !server.silent ? console.warn( 'Local Server started successfully.' ) : ''
        } else if( type === 'remote' ) {
            server.start()
            !server.silent ? console.log( 'Remote Server started successfully.' ) : ''
        } else {
            throw new Error( `Unknown server type: ${type}` )
        }

        return true
    }


    static async #localServer( { argvs, activationPayloads } ) {
        !silent ? console.log( 'Starting Local Server...' ) : ''
        const { silent } = argvs
        const localServer = new LocalServer( { silent } )
        localServer
            .addActivationPayloads( { activationPayloads } )
        this.#serverClass = { 'type': 'local', 'server': localServer }
        const app = localServer.getApp()

        return { app, mcps: null, events: null }
    }


    static #remoteServer( { argvs, activationPayloads } ) {
        const { bearerToken, routePath, rootUrl, port, silent, transportProtocols } = argvs
        const remoteServer = new RemoteServer( { silent } )
        remoteServer
            .setConfig( { 'overwrite': { rootUrl, port } } )
        remoteServer
            .addActivationPayloads( { activationPayloads, routePath, transportProtocols, bearerToken } )
        this.#serverClass = { 'type': 'remote', 'server': remoteServer }

/*
        remoteServer.start()
        !silent ? console.log( 'Remote Server started successfully.' ) : ''
*/
        const app = remoteServer.getApp()
        const mcps = remoteServer.getMcps()
        const events = remoteServer.getEvents()

        return { app, mcps, events }
    }
}


export { LocalServer, RemoteServer, Parameters, Deploy }