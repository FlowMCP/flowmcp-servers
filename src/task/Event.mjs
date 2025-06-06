import { EventEmitter } from 'events'


class Event extends EventEmitter {
    constructor() {
        super()
        this.setMaxListeners( 100 )
    }

    sendEvent( { channelName, message } ) {
        this.emit( channelName, message )
        return true
    }   
}


export { Event }