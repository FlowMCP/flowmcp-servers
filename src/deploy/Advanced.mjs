import { RemoteServer } from '../servers/RemoteServer.mjs'
import { FlowMCP } from 'flowmcp'


class DeployAdvanced {
    static #server


    static init( { silent } ) {
        this.#server = new RemoteServer( { silent } )
        const app = this.#server.getApp()
        const mcps = this.#server.getMcps()
        const events = this.#server.getEvents()
        const server = this.#server

        return { serverType: 'multipleRoutes', app, mcps, events, argvs: null, server  }
    }


    static start( { arrayOfRoutes, objectOfSchemaArrays, envObject, rootUrl, port } ) {
        const { routesActivationPayloads } = RemoteServer
            .prepareRoutesActivationPayloads( { arrayOfRoutes, objectOfSchemaArrays, envObject } )
        this.#server
            .start( { routesActivationPayloads, rootUrl, port } )
        return true
    }
}


export { DeployAdvanced }