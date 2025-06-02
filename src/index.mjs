import { LocalServer } from './servers/LocalServer.mjs'
import { RemoteServer } from './servers/RemoteServer.mjs'
import { Parameters } from './task/Parameters.mjs'
import { FlowMCP } from 'flowmcp'


class Deploy {
    static async quick( { argv, processEnv, arrayOfSchemas } ) {
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

        if( serverType === 'local' ) {
            await Deploy.#localServer( { argvs, activationPayloads } )
        } else if( serverType === 'remote' ) {
            Deploy.#remoteServer( { argvs, activationPayloads } )
        }
    }


    static async #localServer( { argvs, activationPayloads } ) {
        const { silent } = argvs
        const localServer = new LocalServer( { silent: true } )
        localServer
            .addActivationPayloads( { activationPayloads } )
        await localServer.start()
        !silent ? console.warn( 'Local Server started successfully.' ) : ''

        return true
    }


    static #remoteServer( { argvs, activationPayloads } ) {
        const { bearerToken, routePath, rootUrl, port, silent, transportProtocols } = argvs
        const remoteServer = new RemoteServer( { silent } )
        remoteServer
            .setConfig( { 'overwrite': { rootUrl, port } } )
        remoteServer
            .addActivationPayloads( { activationPayloads, routePath, transportProtocols, bearerToken } )
        remoteServer.start()
        !silent ? console.log( 'Remote Server started successfully.' ) : ''

        return true
    }
}


export { LocalServer, RemoteServer, Parameters, Deploy }