// Integration tests against a real PostgreSQL (DATABASE_URL_TEST): npm run test:integration.
// Each run applies every migration into its own schema and drops it afterwards.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test/integration"],
  testMatch: ["**/*.test.js"],
  setupFiles: ["<rootDir>/test/setupEnv.js"],
  globalSetup: "<rootDir>/test/integration/globalSetup.js",
  globalTeardown: "<rootDir>/test/integration/globalTeardown.js",
  clearMocks: true,
  testTimeout: 60000,
  maxWorkers: 1,
};
