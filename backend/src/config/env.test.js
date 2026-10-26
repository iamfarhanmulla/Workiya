jest.mock("dotenv", () => ({ config: jest.fn() }));

const ENV_KEYS = [
  "NODE_ENV",
  "COOKIE_DOMAIN",
  "TRUST_PROXY_HOPS",
  "PASSWORD_REHASH_ON_LOGIN",
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "DATABASE_URL_TEST",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "JWT_PRIVATE_KEY_PATH",
  "JWT_PUBLIC_KEY_PATH",
];

let saved;

function loadConfig(overrides) {
  ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, overrides);
  let config;
  jest.isolateModules(() => {
    // eslint-disable-next-line n/global-require -- reload env inside isolateModules
    config = require("./env");
  });
  return config;
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  });
});

describe("config/env", () => {
  it("treats a missing NODE_ENV as production, so cookies stay Secure", () => {
    // Arrange / Act
    const config = loadConfig({});

    // Assert
    expect(config.nodeEnv).toBe("production");
    expect(config.secureCookies).toBe(true);
    expect(config.trustProxyHops).toBe(0);
    expect(config.cookieDomain).toBeUndefined();
  });

  it.each(["development", "test"])("turns Secure cookies off only for an explicit "
    + "%s environment", (nodeEnv) => {
    // Arrange / Act
    const config = loadConfig({ NODE_ENV: nodeEnv });

    // Assert
    expect(config.secureCookies).toBe(false);
  });

  it("reads the cookie domain and proxy hop count from explicit settings", () => {
    // Arrange / Act
    const config = loadConfig({
      NODE_ENV: "production", COOKIE_DOMAIN: ".example.com", TRUST_PROXY_HOPS: "2",
    });

    // Assert
    expect(config.cookieDomain).toBe(".example.com");
    expect(config.trustProxyHops).toBe(2);
  });

  it("loads without JWT keys and only fails when a key is first used", () => {
    // Arrange
    const config = loadConfig({ NODE_ENV: "test" });

    // Act
    const readKey = () => config.jwt.privateKey;

    // Assert
    expect(readKey).toThrow(/JWT key missing/);
  });

  it("decodes base64 keys once and caches them", () => {
    // Arrange
    const config = loadConfig({
      JWT_PRIVATE_KEY: Buffer.from("private-pem").toString("base64"),
      JWT_PUBLIC_KEY: Buffer.from("public-pem").toString("base64"),
    });

    // Act
    const first = config.jwt.privateKey;
    delete process.env.JWT_PRIVATE_KEY;
    const second = config.jwt.privateKey;

    // Assert
    expect(first).toBe("private-pem");
    expect(second).toBe("private-pem");
    expect(config.jwt.publicKey).toBe("public-pem");
  });

  it("reads keys from files and reports a missing file", () => {
    // Arrange
    const config = loadConfig({
      JWT_PRIVATE_KEY_PATH: __filename,
      JWT_PUBLIC_KEY_PATH: "./does-not-exist.pem",
    });

    // Act
    const readPublic = () => config.jwt.publicKey;

    // Assert
    expect(config.jwt.privateKey).toContain("config/env");
    expect(readPublic).toThrow(/points to a missing file/);
  });

  it("upgrades password hashes at login by default, now that users is Workiya-only", () => {
    // Arrange / Act
    const config = loadConfig({});

    // Assert
    expect(config.auth.passwordRehashOnLogin).toBe(true);
  });

  it("turns password rehashing off only for an explicit false", () => {
    // Arrange / Act
    const config = loadConfig({ PASSWORD_REHASH_ON_LOGIN: "false" });

    // Assert
    expect(config.auth.passwordRehashOnLogin).toBe(false);
  });

  it("reads the pooled, direct and test database URLs", () => {
    // Arrange / Act
    const config = loadConfig({
      DATABASE_URL: "postgresql://pooled",
      DATABASE_URL_DIRECT: "postgresql://direct",
      DATABASE_URL_TEST: "postgresql://test",
    });

    // Assert
    expect(config.database).toEqual({
      url: "postgresql://pooled",
      directUrl: "postgresql://direct",
      testUrl: "postgresql://test",
    });
  });

  it("defaults missing database URLs to empty strings", () => {
    // Arrange / Act
    const config = loadConfig({});

    // Assert
    expect(config.database).toEqual({ url: "", directUrl: "", testUrl: "" });
    expect(config).not.toHaveProperty("mssql");
  });
});
