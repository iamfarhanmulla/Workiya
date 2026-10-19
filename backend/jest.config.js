const STRICT = {
  branches: 95, functions: 95, lines: 95, statements: 95,
};

module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/scripts"],
  setupFiles: ["<rootDir>/test/setupEnv.js"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/config/env.js",
    "src/services/**/*.js",
    "src/middleware/**/*.js",
    "src/utils/**/*.js",
    "src/controllers/**/*.js",
    "src/repositories/**/*.js",
    "src/routes/**/*.js",
    "!**/*.test.js",
  ],
  coverageThreshold: {
    global: {
      branches: 80, functions: 80, lines: 80, statements: 80,
    },
    "./src/services/auth.service.js": STRICT,
    "./src/services/password.service.js": STRICT,
    "./src/services/token.service.js": STRICT,
    "./src/middleware/authenticate.js": STRICT,
    "./src/middleware/authorize.js": STRICT,
    "./src/middleware/csrf.js": STRICT,
    "./src/middleware/rateLimiters.js": STRICT,
    "./src/utils/authCookies.js": STRICT,
    "./src/controllers/auth.controller.js": STRICT,
    "./src/services/tenantScope.js": STRICT,
    "./src/repositories/user.repository.js": STRICT,
    "./src/repositories/refreshToken.repository.js": STRICT,
  },
};
