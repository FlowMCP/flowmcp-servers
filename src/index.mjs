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

        let app = null
        if( serverType === 'local' ) {
            app = Deploy.#localServer( { argvs, activationPayloads } )
        } else if( serverType === 'remote' ) {
            app = Deploy.#remoteServer( { argvs, activationPayloads } )
        } else {
            throw new Error( `Unknown server type: ${serverType}` )
        }

        return { serverType, app  }
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

        return localServer.getApp()
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

        return remoteServer.getApp()
    }
}


export { LocalServer, RemoteServer, Parameters, Deploy }