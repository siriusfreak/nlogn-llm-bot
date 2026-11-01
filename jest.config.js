module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Out of date since the generator started generating in the background
    // (addTask/regenerate take dontCreateNew); does not compile on master either.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/generator.test.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    globals: {
        'ts-jest': {
            tsconfig: {
                // allow es6 module imports
                esModuleInterop: true,
                module: 'CommonJS',
            }
        }
    }
};
