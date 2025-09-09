import fs from 'fs'


class Parameters {
    static getArgvConfig( { type } ) {
        const schemaFilters = [
            [ '--includeNamespaces=',  'includeNamespaces',  'array',   []                              ],
            [ '--excludeNamespaces=',  'excludeNamespaces',  'array',   []                              ],
            [ '--activateTags=',       'activateTags',       'array',   []                              ]
        ]

        const envParameters = [
            [ '--envType=',            'envType',            'string',  'file' /* 'processEnv' */      ],
            [ '--envPath=',            'envPath',            'string',  '.example.env'                  ]
        ]

        const serverParameters = [
            [ '--serverType=',         'serverType',         'string',  'remote'  /* remote */                        ]
        ]

        const localServerParameters = [
        ]

        const remoteServerParameters = [
            [ '--port='              , 'port'              , 'number' , 8080                      ],
            [ '--rootUrl='           , 'rootUrl'           , 'string' , 'http://localhost'        ],
            [ '--silent='            , 'silent'            , 'boolean', false                     ],
            [ '--transportProtocols=', 'transportProtocols', 'array'  , [ 'sse', 'streamable' ]   ],
            [ '--routePath='         , 'routePath'         , 'string' , '/flowmcp'                ]
        ]


        const config = {
            'default': [
                ...schemaFilters,
                ...envParameters,
                ...serverParameters,
                // ...localServerParameters,
                // ...remoteServerParameters
            ],
            'local': [
                ...localServerParameters
            ],
            'remote': [
                ...remoteServerParameters
            ]
        }

        if( !config[ type ] ) {
            throw new Error( `Unknown type: ${type}. Available types: ${Object.keys( config ).join( ', ' )}` )
        }


        return config[ type ]
    }


    static getParameters( { argv, processEnv, arrayOfSchemas } ) {
        let argvs = {}
        let envObject = {}
        {
            const { status, messages, result } = Parameters
                .#getServerArgvParameters( { argv, type: 'default' } )
            if( !status ) { Parameters.#printError( { messages } ) }
            argvs = result
            const { serverType } = argvs
            const { status: s2, messages: m2, result: r2 } = Parameters
                .#getServerArgvParameters( { argv, type: serverType } )
            if( !s2 ) { Parameters.#printError( { messages: m2 } ) }
            argvs = { ...argvs, ...r2 }
        }

        {
            const { envType, envPath } = argvs
            const { status, messages, result } = Parameters.#getEnvObject( { envType, envPath, processEnv, arrayOfSchemas } )
            if( !status ) { Parameters.#printError( { messages } ) }
            envObject = result
        }

        return { argvs, envObject }
    }


    static #getServerArgvParameters( { argv, type } ) {   
        const messages = []
        let result = {}
        try {
            result = Parameters
                .getArgvConfig( { type } )
                .reduce( ( acc, [ prefix, key, type, _defaultValue ] ) => {
                    let value = argv
                        .find( ( arg ) => arg.startsWith( prefix ) )
                    if( value === undefined ) {
                        acc[ key ] = _defaultValue
                        return acc
                    }
                    value = value.replace( prefix, '' ).trim()
                    if( type === 'array' ) { value = value.split( ',' ).filter( Boolean ) }
                    else if( type === 'number' ) { value = Number( value ) } 
                    else if( type === 'boolean' ) { value = value === 'true' }

                    acc[ key ] = value

                    return acc
                }, {} )
        } catch( e ) {
            messages.push( `Error parsing arguments: ${e.message}` )
        }         

        return { status: messages.length === 0, messages, result }
    }


    static #getEnvObject( { envType, envPath, processEnv, arrayOfSchemas } ) {
        const messages = []
        const allParams = Array
            .from(
                arrayOfSchemas
                    .reduce( 
                        ( acc, { requiredServerParams } ) => { acc.add( ...requiredServerParams ); return acc }, 
                        new Set() 
                    )
            )
            .filter( ( param ) => param !== undefined && param !== null && param !== '' )

        let loadedObject = {}
        switch( envType ) {
            case 'file': {
                loadedObject = fs
                    .readFileSync( envPath, 'utf-8' )
                    .split( '\n' )
                    .reduce( ( acc, line ) => {
                        const [ key, value ] = line.split( '=' )
                        if( key && value ) { acc[ key.trim() ] = value.trim() }
                        return acc
                    }, {} )
                break
            }
            case 'processEnv': {
                loadedObject = processEnv
                break
            }
            default: {
                messages.push( `Unknown envType: ${envType}` )
            }
        }

        if( messages.length > 0 ) { return { status: false, messages, result: {} } }
        const envObject = allParams
            .reduce( ( acc, param ) => {
                if( loadedObject[ param ] !== undefined ) { acc[ param ] = loadedObject[ param ] } 
                else { messages.push( `Parameter "${param}" is not defined in the environment.` ) }
                return acc
            }, {} )

        return { status: messages.length === 0, messages, result: envObject }
    }


    static #printError( { messages } ) {
        throw new Error(
            `.getParameters: Error: ${messages.join( '\n' )}`
        )
    }
}


export { Parameters }