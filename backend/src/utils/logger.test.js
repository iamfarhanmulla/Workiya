function loadLogger(env) {
  const saved = { LOG_LEVEL: process.env.LOG_LEVEL, NODE_ENV: process.env.NODE_ENV };
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
  let logger;
  jest.isolateModules(() => {
    logger = require("./logger");
  });
  Object.assign(process.env, saved);
  return logger;
}

describe("logger", () => {
  it("uses LOG_LEVEL when it is set", () => {
    // Arrange / Act
    const logger = loadLogger({ LOG_LEVEL: "warn", NODE_ENV: "test" });

    // Assert
    expect(logger.level).toBe("warn");
  });

  it("is silent under NODE_ENV=test when LOG_LEVEL is not set", () => {
    // Arrange / Act
    const logger = loadLogger({ LOG_LEVEL: undefined, NODE_ENV: "test" });

    // Assert
    expect(logger.level).toBe("silent");
  });

  it("defaults to info outside tests", () => {
    // Arrange / Act
    const logger = loadLogger({ LOG_LEVEL: undefined, NODE_ENV: "development" });

    // Assert
    expect(logger.level).toBe("info");
  });
});
