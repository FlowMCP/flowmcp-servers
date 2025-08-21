export default {
    testEnvironment: 'node',
    transform: {},
    testMatch: [ '**/tests/unit/**/*.test.mjs' ],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: [ 'text', 'html' ],
    verbose: true
}