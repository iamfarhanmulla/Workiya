// next has no "exports" map, so Node ESM needs the explicit .js extension here.
// eslint-disable-next-line import-x/extensions -- required by Node ESM resolution
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  collectCoverageFrom: [
    "{app,components,hooks,lib,store}/**/*.{js,jsx}",
    "proxy.js",
    "!**/*.test.{js,jsx}",
  ],
};

export default createJestConfig(config);
