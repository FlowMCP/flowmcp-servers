# How to setup


```js
{
  "globalShortcut": "",
  "mcpServers": {
    "FlowMCP": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/project/tests/claude/start.mjs",
        "--includeNamespaces=",
        "--excludeNamespaces=",
        "--activateTags=",
        "--envType=processEnv",
        "--serverType=local",
        "--silent=true"
      ],
      "env": {
        "SOLANA_TRACKER_API_KEY":"",
        "MORALIS_API_KEY":"",
        "ETHERSCAN_API_KEY":"",
        "CRYPTOPANIC_API_KEY":"",
        "DUNE_API_KEY":"",
        "NEWSDATA_API_KEY":"",
        "SANTIMENT_API_KEY":"",
        "SOLSNIFFER_API_KEY":"",
        "THEGRAPH_API_KEY":"",
        "CMC_API_KEY":"",
        "BITQUERY_ID":"",
        "BITQUERY_API_KEY":"",
        "ALCHEMY_API_KEY":"",
        "INFURA_API_KEY":"",
        "SOLSCAN_API_KEY":"",
        "BSCSCAN_API_KEY":"",
        "COINCAP_API_KEY":"",
        "BLOCKNATIVE_API_KEY":"",
        "COINSTATS_API_KEY": "",
        "TWITTER_BEARER_TOKEN": ""
      }
    }
  }
}
```