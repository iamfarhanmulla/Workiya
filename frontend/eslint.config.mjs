// ESLint 9 flat config for the Workiya frontend (Next.js 16, React 19, JSX).
// Ruleset: Airbnb (PlexiTech standard) via eslint-config-airbnb-extended, the
// maintained flat-config port of eslint-config-airbnb for ESLint 9, layered
// on top of Next.js' own flat config (eslint-config-next/core-web-vitals).
// Next 16 removed `next lint`, so this file is run with the eslint CLI.
import path from "node:path";
import js from "@eslint/js";
import { configs, helpers, plugins } from "eslint-config-airbnb-extended";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const TEST_FILES = ["**/*.test.js", "**/*.test.jsx", "jest.setup.js"];

const { jsExtensionsWithReact } = helpers.extensions;

// Airbnb's default Node resolver for .js/.jsx/.mjs files.
const airbnbResolvers = helpers.getImportSettings({
  javascript: true, typescript: false, jsx: true,
})["import-x/resolver-next"];

const config = [
  {
    name: "workiya/ignores",
    ignores: [".next/**", ".swc/**", "coverage/**", "node_modules/**", "next-env.d.ts"],
  },

  // Next.js first (parser, globals, @next/next rules); Airbnb after it so the
  // stricter Airbnb React / jsx-a11y settings win where the two overlap.
  ...nextCoreWebVitals,
  { name: "js/recommended", ...js.configs.recommended },
  plugins.stylistic,
  plugins.importX,
  plugins.react,
  plugins.reactHooks,
  // plugins.reactA11y is intentionally omitted: eslint-config-next already
  // registers the same eslint-plugin-jsx-a11y package under "jsx-a11y" (wrapped
  // in a different object), and ESLint refuses to register a plugin name twice.
  // Airbnb's jsx-a11y rules from configs.react.recommended still apply.
  ...configs.base.recommended,
  ...configs.react.recommended,

  {
    name: "workiya/language",
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    languageOptions: {
      // Airbnb pins parserOptions.ecmaVersion to 2018; the code base uses ?. and ??.
      parserOptions: { ecmaVersion: 2024 },
    },
    settings: {
      // Resolve the "@/..." alias declared in jsconfig.json (also used by jest moduleNameMapper).
      "import-x/resolver-next": [
        ...airbnbResolvers,
        helpers.createAutoTypeScriptImportResolver({
          project: path.join(import.meta.dirname, "jsconfig.json"),
          extensions: [...jsExtensionsWithReact, ".json"],
        }),
      ],
    },
  },

  // Project overrides of the Airbnb defaults.
  {
    name: "workiya/overrides",
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    rules: {
      // Repo-wide convention is double quotes (Airbnb default is single).
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      "@stylistic/jsx-quotes": ["error", "prefer-double"],
      // Line endings are owned by git, not the linter: the index stores LF, but
      // Windows checkouts with core.autocrlf=true have CRLF in the working tree.
      "@stylistic/linebreak-style": "off",
      // Next.js / React 17+ automatic JSX runtime: React need not be in scope.
      "react/react-in-jsx-scope": "off",
      // Next.js App Router files (page.jsx, layout.jsx) and hooks/tests use both extensions.
      "react/jsx-filename-extension": ["error", { extensions: [".jsx", ".js"] }],
      // Match the existing style: function declarations for components, arrow
      // functions allowed for small inline components (icons).
      "react/function-component-definition": ["error", {
        namedComponents: ["function-declaration", "arrow-function"],
        unnamedComponents: "arrow-function",
      }],
      // prop-types is not a dependency of this project and React 19 no longer
      // checks propTypes at runtime; props are validated by tests instead.
      // (eslint-config-next also turns it off.)
      "react/prop-types": "off",
      // Its --fix drops significant JSX whitespace: "Showing {n} of {m}" became
      // "Showing{n} of{m}" and "Name <span>*</span>" lost its space (verified by
      // comparing compiled output before/after). Off so lint:fix stays safe.
      "react/jsx-one-expression-per-line": "off",
      // PlexiTech standard: flag (not block) files > 300 lines and functions > 50 lines.
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", {
        max: 50, skipBlankLines: true, skipComments: true, IIFEs: true,
      }],
      // Airbnb's devDependencies globs only cover *.test.{js,cjs,mjs,ts,...}, not
      // *.test.jsx, so React Testing Library imports in .jsx tests were flagged.
      "import-x/no-extraneous-dependencies": ["error", {
        devDependencies: [...helpers.getDevDepsList("javascript"), "**/*.test.jsx"],
        optionalDependencies: false,
        peerDependencies: true,
        bundledDependencies: true,
      }],
      // Airbnb uses assert: "both" (label must wrap the input AND point to it with
      // htmlFor). Our forms place the label beside the input and link it with
      // htmlFor/id, which is equally accessible; nesting would change the layout.
      "jsx-a11y/label-has-associated-control": ["error", { assert: "either", depth: 25 }],
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
