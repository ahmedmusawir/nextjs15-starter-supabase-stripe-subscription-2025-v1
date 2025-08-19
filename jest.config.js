// jest.config.js
module.exports = {
  // Use ts-jest to process TypeScript files
  preset: 'ts-jest',

  // The environment in which the tests are run
  testEnvironment: 'node',

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src'],

  // The testMatch patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
