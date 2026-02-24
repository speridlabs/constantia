/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.test.json',
            },
        ],
    },
    moduleNameMapper: {
        '^constantia$': '<rootDir>/dist/index.js',
        '^constantia/(.*)$': '<rootDir>/dist/$1',
    },
    testMatch: ['**/tests/**/*.test.ts'],
};
