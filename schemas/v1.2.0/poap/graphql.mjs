const poapQueries = {
    poapsFromBerlin: {
        description: "Returns the top 5 POAP drops from Berlin with the most tokens minted, including event details.",
        query: `{ drops(where: {_or: [{name: {_ilike: "%Berlin%"}}, {description: {_ilike: "%Berlin%"}}]}, limit: 20) { id name description city country start_date end_date image_url fancy_id } }`
    },
    highestAttendanceLastYear: {
        description: "Returns the top 5 POAP drops from 2024 with the most tokens minted, including event details and attendance count.",
        query: `{ drops( where: {start_date: {_gt: "2024-01-01"}}, limit: 5, order_by: {poaps_aggregate: {count: desc}} ) { id name fancy_id start_date end_date city country poaps_aggregate { aggregate { count } } } }`
    },
    collectorPoaps: {
        description: "Retrieves the total POAP count for a specific wallet address and shows a sample of their collected events.",
        query: `{ collectors( where: {address: {_eq: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"} } ) { address poaps_aggregate { aggregate { count } } poaps(limit: 5) { drop { name start_date } } } }`
    },
    mostTransferredPoaps: {
        description: "Identifies the POAPs with the highest transfer counts, which may indicate high value or popularity in secondary markets.",
        query: `{ poaps( limit: 5, order_by: {transfer_count: desc} ) { id transfer_count drop { name fancy_id start_date } } }`
    },
    dropsBasicInfo: {
        description: "Retrieves basic information about POAP drops including location data, useful for geographic distribution analysis.",
        query: `{ drops(limit: 5) { id name city country } }`
    },
    poapsByChain: {
        description: "Examines the blockchain network distribution of POAPs, showing which chains are most commonly used for minting.",
        query: `{ poaps(limit: 10) { chain id minted_on } }`
    },
    artistsList: {
        description: "Lists artists who have contributed to POAP designs, providing insight into the creative contributors to the ecosystem.",
        query: `{ collections_artists { name } }`
    },
    recentMoments: {
        description: "Explores user-created moments associated with POAPs, showing how people memorialize their experiences with digital collectibles.",
        query: `{ moments( limit: 5, order_by: {created_on: desc} ) { id created_on author drops { drop { name } } } }`
    },
    topCollectors: {
        description: "Identifies the most prolific POAP collectors, whose collections could be further analyzed for thematic preferences.",
        query: `{ collectors( limit: 3, order_by: {poaps_owned: desc} ) { address poaps_owned } }`
    },
    mostExclusiveDrops: {
        description: "Examines the rarity spectrum of POAP drops by finding those with the fewest minted tokens, indicating exclusivity.",
        query: `{ drops( limit: 10, order_by: {poaps_aggregate: {count: asc}} ) { id name fancy_id poaps_aggregate { aggregate { count } } } }`
    },
    mostPopularDrops: {
        description: "Identifies the most popular POAP events of all time based on total participation, showing which events resonated most with the community.",
        query: `{ drops( limit: 10, order_by: {poaps_aggregate: {count: desc}} ) { id name fancy_id poaps_aggregate { aggregate { count } } } }`
    }
}


const schema = {
    namespace: "poap",
    name: "POAP GraphQL",
    description: "GraphQL endpoint for accessing POAP event data and metadata",
    docs: ["https://public.compass.poap.tech/v1/graphql"],
    tags: ["production", "graphql", "poap"],
    flowMCP: "1.2.0",
    root: "https://public.compass.poap.tech/v1/graphql",
    requiredServerParams: [],
    headers: {
        "content-type": "application/json"
    },
    routes: {
        getTypename: {
            requestMethod: "POST",
            description: "Simple GraphQL query to retrieve the __typename root for basic connectivity test.",
            route: "/",
            parameters: [
                { position: { key: "query", value: "query { __typename }", location: "body" }, z: { primitive: "string()", options: [] } }
            ],
            tests: [
                { _description: "Simple __typename query test" }
            ],
            modifiers: []
        },
        getSchemaDefinition: {
            requestMethod: "POST",
            description: "Returns the full GraphQL schema via introspection",
            route: "/",
            parameters: [
                {
                    position: {
                        key: "query",
                        value: "query IntrospectionQuery { __schema { types { name kind fields { name type { name kind ofType { name kind } } } } } }",
                        location: "body"
                    },
                    z: { primitive: "string()", options: [] }
                }
            ],
            tests: [
                { _description: "Returns full GraphQL schema" }
            ],
            modifiers: []
        },
        getPredefinedQueryList: {
            requestMethod: "GET",
            description: "Run a predefined GraphQL query.",
            route: "/",
            parameters: [],
            tests: [
                { _description: "Sample query for entity data"  }
            ],
            modifiers: [
                { phase: "execute", handlerName: "listQuestions" }
            ]
        },
        executePrefinedQuery: {
            requestMethod: "POST",
            description: "Run a predefined GraphQL query.",
            route: "/",
            parameters: [
                { position: { key: "queryId", value: "{{USER_PARAM}}", location: "insert" }, z: { primitive: `enum(${Object.keys( poapQueries )})`, options: [] } },
                { position: { key: "query", value: "placeholder", location: "body" }, z: { primitive: "string()", options: [] } }
            ],
            tests: [
                ...Object
                    .entries( poapQueries)
                    .map( ( [ queryId, { description } ] ) => { return { _description: description, queryId } } )
            ],
            modifiers: [
                { phase: "pre", handlerName: "insertPredefinedQuery" }
            ]
        },
        querySubgraph: {
            requestMethod: "POST",
            description: "Run a raw GraphQL query.",
            route: "/",
            parameters: [
                { position: { key: "query", value: "{{USER_PARAM}}", location: "body" }, z: { primitive: "string()", options: [] } }
            ],
            modifiers: [],
            tests: [
                { _description: "Sample query for entity data", query: "query { collections_artists { name } }" }
            ]
        }
    },
    handlers: {
        insertPredefinedQuery: ( { struct, payload, userParams } ) => {
            const { queryId } = userParams
            const { query } = poapQueries[ queryId ]
            payload['body']['query'] = query
            return { struct, payload }
        },
        listQuestions: ( { struct, payload } ) => {
            struct['status'] = true
            struct['data'] = Object
                .entries( poapQueries )
                .map( ( [ queryId, { description } ] ) => {
                    return { description, queryId }
                } )
            return { struct, payload }
        }
    }
};


export { schema }
