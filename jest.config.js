/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    transform: { '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: { rootDir: '.' } }] },
};
