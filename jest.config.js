export default {
    transform: {
        '^.+\\.mjs$': 'babel-jest'
    },
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@modelcontextprotocol/sdk/(.*)$': '<rootDir>/node_modules/@modelcontextprotocol/sdk/$1'
    }
}