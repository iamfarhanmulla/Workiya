/* eslint-disable max-classes-per-file -- fakes for both pg.Pool and pg.Client */
const mockPools = [];
const mockTypeParsers = {};
const mockClientQueries = [];

jest.mock("pg", () => {
  class FakeClient {
    async connect() {
      this.connected = true;
    }

    async query(text) {
      if (text.includes("broken")) {
        throw new Error("bad schema");
      }
      this.lastQuery = text;
      mockClientQueries.push(text);
    }
  }
  class FakePool {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.client = {
        query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
        release: jest.fn(),
      };
      this.query = jest.fn(async () => ({ rows: [{ id: 1 }], rowCount: 1, command: "SELECT" }));
      this.connect = jest.fn(async () => this.client);
      this.end = jest.fn(async () => {});
      mockPools.push(this);
    }

    on(event, handler) {
      this.handlers[event] = handler;
      return this;
    }
  }
  return {
    Pool: FakePool,
    Client: FakeClient,
    types: {
      builtins: { NUMERIC: 1700, INT8: 20 },
      setTypeParser: (oid, parser) => {
        mockTypeParsers[oid] = parser;
      },
    },
    escapeIdentifier: (name) => `"${name.replace(/"/g, '""')}"`,
  };
});
jest.mock("../utils/logger", () => ({ error: jest.fn() }));
jest.mock("./env", () => ({
  database: {
    url: "postgresql://app:secret@pooled.example/workiya?sslmode=require&channel_binding=require",
  },
}));

const logger = require("../utils/logger");
const db = require("./db");

afterEach(async () => {
  await db.configure({});
});

describe("config/db setup", () => {
  it("parses NUMERIC and INT8 values as JS numbers", () => {
    // Arrange / Act
    const parsed = [mockTypeParsers[1700]("12.3456789"), mockTypeParsers[20]("42")];

    // Assert
    expect(parsed).toEqual([12.3456789, 42]);
  });

  it("forces verified TLS and channel binding from the URL, and honours sslmode=disable", () => {
    // Arrange
    const neon = "postgresql://u:p@host.example/db?sslmode=require&channel_binding=require";

    // Act
    const tls = db.connectionConfig(neon);
    const local = db.connectionConfig("postgresql://u:p@localhost/db?sslmode=disable");

    // Assert
    expect(tls).toEqual({
      connectionString: "postgresql://u:p@host.example/db",
      ssl: { rejectUnauthorized: true },
      enableChannelBinding: true,
    });
    expect(local.ssl).toBe(false);
    expect(local.enableChannelBinding).toBe(false);
    expect(() => db.connectionConfig("")).toThrow(/DATABASE_URL/);
  });

  it("creates the shared pool lazily, once, from DATABASE_URL", async () => {
    // Arrange
    const before = mockPools.length;

    // Act
    const first = db.getPool();
    const second = db.getPool();

    // Assert
    expect(first).toBe(second);
    expect(mockPools.length).toBe(before + 1);
    expect(first.options.connectionString).toBe("postgresql://app:secret@pooled.example/workiya");
    expect(first.options.max).toBe(10);
    expect(first.options.Client).toBeUndefined();
  });

  it("logs errors of idle clients instead of crashing", () => {
    // Arrange
    const pool = db.createPool({ url: "postgresql://u@h/d", max: 2 });
    const err = new Error("idle");

    // Act
    pool.handlers.error(err);

    // Assert
    expect(pool.options.max).toBe(2);
    expect(logger.error).toHaveBeenCalledWith({ err }, "Idle PostgreSQL client failed");
  });

  it("sets search_path while connecting, before the client is used", async () => {
    // Arrange
    await db.configure({ url: "postgresql://u@test/d", searchPath: "it_1, public" });
    const { Client } = db.getPool().options;
    const done = jest.fn();

    // Act
    await new Client().connect();
    new Client().connect(done);
    await new Promise(setImmediate);

    // Assert
    expect(db.getPool().options.connectionString).toBe("postgresql://u@test/d");
    expect(mockClientQueries).toEqual([
      'SET search_path TO "it_1", "public"',
      'SET search_path TO "it_1", "public"',
    ]);
    expect(done).toHaveBeenCalledWith();
  });

  it("reports a failed search_path to the pool's connect callback", async () => {
    // Arrange
    const pool = db.createPool({ url: "postgresql://u@test/d", searchPath: ["broken"] });
    const done = jest.fn();

    // Act
    new pool.options.Client().connect(done);
    await new Promise(setImmediate);

    // Assert
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ message: "bad schema" }));
  });

  it("closes the previous pool when reconfigured, and closing twice is harmless", async () => {
    // Arrange
    const pool = db.getPool();

    // Act
    await db.configure({ searchPath: ["s"] });
    await db.closePool();

    // Assert
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});

describe("config/db query", () => {
  it("compiles named parameters and returns only rows and rowCount", async () => {
    // Arrange
    const pool = db.getPool();

    // Act
    const result = await db.query("SELECT * FROM t WHERE id = @id AND c = @id", { id: 5 });

    // Assert
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM t WHERE id = $1 AND c = $1", [5]);
    expect(result).toEqual({ rows: [{ id: 1 }], rowCount: 1 });
  });

  it("rejects a query whose parameter is missing without touching the database", async () => {
    // Arrange
    const pool = db.getPool();

    // Act
    const run = db.query("SELECT @missing");

    // Assert
    await expect(run).rejects.toThrow(/@missing/);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("config/db withTransaction", () => {
  it("commits and releases the client", async () => {
    // Arrange
    const { client } = db.getPool();

    // Act
    const result = await db.withTransaction(async (tx) => {
      await tx.query("UPDATE t SET a = @a", { a: 1 });
      await tx.query("SELECT 1");
      return "done";
    });

    // Assert
    expect(result).toBe("done");
    expect(client.query.mock.calls).toEqual([
      ["BEGIN"], ["UPDATE t SET a = $1", [1]], ["SELECT 1", []], ["COMMIT"],
    ]);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it("rolls back and rethrows the original error", async () => {
    // Arrange
    const { client } = db.getPool();
    const failure = new Error("work failed");

    // Act
    const run = db.withTransaction(async () => {
      throw failure;
    });

    // Assert
    await expect(run).rejects.toBe(failure);
    expect(client.query.mock.calls).toEqual([["BEGIN"], ["ROLLBACK"]]);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it("logs a failed ROLLBACK, rethrows the original error, discards the connection", async () => {
    // Arrange
    const { client } = db.getPool();
    const failure = new Error("work failed");
    const rollbackFailure = new Error("connection lost");
    client.query.mockImplementation(async (text) => {
      if (text === "ROLLBACK") {
        throw rollbackFailure;
      }
      return { rows: [], rowCount: 0 };
    });

    // Act
    const run = db.withTransaction(async () => {
      throw failure;
    });

    // Assert
    await expect(run).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      { err: rollbackFailure },
      "ROLLBACK failed; the connection is discarded",
    );
    expect(client.release).toHaveBeenCalledWith(rollbackFailure);
  });
});

describe("config/db error helpers", () => {
  it.each([
    ["isUniqueViolation", "23505"],
    ["isForeignKeyViolation", "23503"],
    ["isCheckViolation", "23514"],
  ])("%s recognises SQLSTATE %s only", (helper, code) => {
    // Arrange
    const check = db[helper];

    // Act
    const results = [check({ code }), check({ code: "99999" }), check(null)];

    // Assert
    expect(results).toEqual([true, false, false]);
  });
});
