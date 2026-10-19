// ESLint 9 flat config for the Workiya backend (Node 22, CommonJS).
// Ruleset: Airbnb (PlexiTech standard) via eslint-config-airbnb-extended, the
// maintained flat-config port of eslint-config-airbnb-base for ESLint 9.
//
// This file is .mjs (not .js) on purpose: eslint-config-airbnb-extended is
// ESM-only, and backend/package.json is CommonJS, so an eslint.config.js here
// would have to require() an ES module (still experimental on Node 22.14).
import js from "@eslint/js";
import { configs, plugins } from "eslint-config-airbnb-extended";
import globals from "globals";

const TEST_FILES = ["**/*.test.js", "test/**/*.js"];

// Command-line tools that legitimately write to stdout/stderr.
const CLI_FILES = ["src/config/migrate.js", "src/config/seed.js", "scripts/**/*.js"];

const config = [
  {
    name: "workiya/ignores",
    ignores: ["coverage/**", "keys/**", "node_modules/**"],
  },

  // Airbnb base + Airbnb's Node rules.
  { name: "js/recommended", ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  plugins.node,
  ...configs.base.recommended,
  ...configs.node.recommended,

  // Application source is CommonJS.
  {
    name: "workiya/commonjs",
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      // Airbnb pins parserOptions.ecmaVersion to 2018, which cannot parse the
      // ?. and ?? operators the code base uses (Node 22 supports ES2024).
      ecmaVersion: 2024,
      parserOptions: { ecmaVersion: 2024 },
      globals: { ...globals.node },
    },
  },

  // Project overrides of the Airbnb defaults.
  {
    name: "workiya/overrides",
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      // Repo-wide convention is double quotes (Airbnb default is single).
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      // Line endings are owned by git, not the linter: the index stores LF, but
      // Windows checkouts with core.autocrlf=true have CRLF in the working tree.
      "@stylistic/linebreak-style": "off",
      // Use the pino logger (src/utils/logger.js) instead of console.
      "no-console": "error",
      // PlexiTech standard: flag (not block) files > 300 lines and functions > 50 lines.
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", {
        max: 50, skipBlankLines: true, skipComments: true, IIFEs: true,
      }],
      // devDependencies may only be imported from tests, test helpers, scripts and tooling config.
      "import-x/no-extraneous-dependencies": ["error", {
        devDependencies: [...TEST_FILES, "scripts/**", "jest.config.js", "eslint.config.mjs"],
        optionalDependencies: false,
        peerDependencies: true,
        bundledDependencies: true,
      }],
    },
  },

  {
    name: "workiya/cli-tools",
    files: CLI_FILES,
    rules: {
      "no-console": "off",
    },
  },

  {
    name: "workiya/tests",
    files: TEST_FILES,
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // Test suites are long describe() blocks by nature.
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
];

export default config;
