import axios from "axios"
import moment from "moment"


const timeframes = {
    "1s": 1,
    "10s": 10,
    "30s": 30,
    "1min": 60,
    "5min": 300,
    "10min": 600,
    "30min": 1800,
    "1h": 3600,
    "4h": 14400,
    "12h": 43200,
    "1d": 86400,
    "1w": 604800,
    "1M": 2592000
}

const fromDateUnits = {
    "minutes": 60,
    "hours": 3600,
    "days": 86400,
    "weeks": 604800,
    "months": 2592000,
    "years": 31536000
}

const chainSelections = {
    "ETHEREUM_MAINNET": "eth",
    "ETHEREUM_SEPOLIA": "sepolia",
    "ETHEREUM_HOLESKY": "holesky",
    "POLYGON_MAINNET": "polygon",
    "POLYGON_AMOY": "polygon amoy",
    "BSC_MAINNET": "bsc",
    "BSC_TESTNET": "bsc testnet",
    "AVALANCHE_MAINNET": "avalanche",
    "FANTOM_MAINNET": "fantom",
    "CRONOS_MAINNET": "cronos",
    "ARBITRUM_MAINNET": "arbitrum",
    "GNOSIS_MAINNET": "gnosis",
    "GNOSIS_TESTNET": "gnosis testnet",
    "CHILIZ_MAINNET": "chiliz",
    "CHILIZ_TESTNET": "chiliz testnet",
    "BASE_MAINNET": "base",
    "BASE_SEPOLIA": "base sepolia",
    "OPTIMISM_MAINNET": "optimism",
    "LINEA_MAINNET": "linea",
    "LINEA_SEPOLIA": "linea sepolia",
    "MOONBEAM_MAINNET": "moonbeam",
    "MOONRIVER_MAINNET": "moonriver",
    "MOONBASE_TESTNET": "moonbase",
    "FLOW_MAINNET": "flow",
    "FLOW_TESTNET": "flow-testnet",
    "RONIN_MAINNET": "ronin",
    "RONIN_TESTNET": "ronin-testnet",
    "LISK_MAINNET": "lisk",
    "LISK_SEPOLIA": "lisk-sepolia",
    "PULSE_MAINNET": "pulse"
}


const schema = {
    namespace: "ohlcv",
    name: "Moralis Recursive OHLCV EVM and Ethereum",
    description: "Recursively fetches OHLCV data from Moralis for EVM token pairs.",
    docs: ["https://docs.moralis.io/web3-data-api/evm/reference/get-ohlcv-by-pair-address"],
    tags: [],
    flowMCP: "1.2.0",
    root: "https://deep-index.moralis.io",
    requiredServerParams: ["MORALIS_API_KEY"],
    headers: { "X-API-Key": "{{MORALIS_API_KEY}}" },
    routes: {
        getRecursiveOhlcvEVM: {
            requestMethod: "GET",
            description: "Fetch OHLCV data recursively until max length or iteration limit is reached.",
            route: "/api/v2.2/pairs/{{pairAddress}}/ohlcv",
            parameters: [
                { position: { key: "pairAddress", value: "{{USER_PARAM}}", location: "insert" }, z: { primitive: "string()", options: [] } },
                { position: { key: "chain", value: "{{USER_PARAM}}", location: "query" }, z: { primitive: `enum(${Object.keys(chainSelections).join(",")})`, options: [] } },
                { position: { key: "timeframe", value: "{{USER_PARAM}}", location: "query" }, z: { primitive: "enum(" + Object.keys(timeframes).join(",") + ")", options: [] } },
                { position: { key: "currency", value: "{{USER_PARAM}}", location: "query" }, z: { primitive: "enum(usd,native)", options: ["default(usd)"] } },
                { position: { key: "fromDateAmount", value: "{{USER_PARAM}}", location: "query" }, z: { primitive: "number()", options: [] } },
                { position: { key: "fromDateUnit", value: "{{USER_PARAM}}", location: "query" }, z: { primitive: "enum(" + Object.keys(fromDateUnits).join(",") + ")", options: [] } },
                { position: { key: "maxResultLength", value: "{{USER_PARAM}}", location: "query" }, z: { primitive: "number()", options: ["optional(), default(1000)"] } }
            ],
            tests: [
                { _description: "Fetch 7-day OHLCV data for Uniswap pair on Ethereum", pairAddress: "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f", chain: "eth", timeframe: "1min", currency: "usd", fromDateAmount: 7, fromDateUnit: "days", maxResultLength: 1000 }
            ],
            modifiers: [
                { phase: "execute", handlerName: "fetchRecursiveOhlcvEvm" }
            ]
        }
    },
    handlers: {
        fetchRecursiveOhlcvEvm: async ( { struct, payload, userParams } ) => {
            const { pairAddress, chain: _chainValue, timeframe, currency, fromDateAmount, fromDateUnit, maxResultLength = 1000 } = userParams
            const chain = chainSelections[ _chainValue ]
            const fromDate = moment().subtract(fromDateAmount, fromDateUnit).toISOString();
            const toDate = moment().toISOString();
            const url = `https://deep-index.moralis.io/api/v2.2/pairs/${pairAddress}/ohlcv`;

            let accumulated = [], cursor = null, iteration = 0, maxIterations = 5;
            while (iteration < maxIterations && accumulated.length < maxResultLength) {
                try {
                    const { headers } = payload
                    const params = { chain, timeframe, currency, fromDate, toDate, cursor, limit: 1000 }
                    const res = await axios.get(url, { headers, params } )
                    const { result, cursor: next } = res.data
                    if( !Array.isArray( result ) ) { break }
                    accumulated.push( ...result )
                    if( !next ) { break }
                    cursor = next
                    iteration++
                } catch( e ) {
                    struct.status = false
                    struct.messages.push( "API error: " + (e.response?.status || "unknown" ) )
                    return { struct, payload }
                }
            }

            const data = accumulated
                .map( ( a ) => ( { ...a, unixTimestamp: moment( a.timestamp ).unix() } ) )
                .sort( ( a, b ) => a.unixTimestamp - b.unixTimestamp )
                .reduce( ( acc, a ) => {
                    acc.openings.push( a.open )
                    acc.closings.push( a.close )
                    acc.highs.push( a.high )
                    acc.lows.push( a.low )
                    acc.volumes.push( a.volume )
                    acc.timestamps.push( a.timestamp )
                    acc.prices.push( a.close )
                    acc.values.push( a.close )
                    return acc
                }, {
                    openings: [],
                    closings: [],
                    highs: [],
                    lows: [],
                    volumes: [],
                    prices: [],
                    values: [],
                    timestamps: []
                } )

            struct['data'] = data
            struct['status'] = true
            return { struct, payload }
        }
    }
}


export { schema }
