const {
  mockDb, rows, affected, allParams,
} = require("./mockDb");

describe("test helper mockDb", () => {
  it("answers queued results in order, records calls and defaults to an empty result", async () => {
    // Arrange
    const db = mockDb([rows({ id: 1 }, { id: 2 }), affected(3)]);

    // Act
    const first = await db.query("SELECT id FROM t WHERE a = @a", { a: 1 });
    const second = await db.query("UPDATE t SET b = 1");
    const third = await db.query("SELECT 1");

    // Assert
    expect(first).toEqual({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });
    expect(second).toEqual({ rows: [], rowCount: 3 });
    expect(third).toEqual({ rows: [], rowCount: 0 });
    expect(db.calls[0]).toEqual({ text: "SELECT id FROM t WHERE a = @a", params: { a: 1 } });
    expect(db.query).toHaveBeenCalledTimes(3);
  });

  it("throws queued errors and missing named parameters like the real helper", async () => {
    // Arrange
    const failure = Object.assign(new Error("dup"), { code: "23505" });
    const db = mockDb([failure]);

    // Act
    const failed = await db.query("INSERT INTO t VALUES (1)").catch((err) => err);
    const missing = db.query("SELECT @id");

    // Assert
    expect(failed).toBe(failure);
    expect(db.isUniqueViolation(failed)).toBe(true);
    await expect(missing).rejects.toThrow(/@id/);
  });

  it("records BEGIN / COMMIT around a successful transaction", async () => {
    // Arrange
    const db = mockDb([rows({ id: 9 })]);

    // Act
    const result = await db.withTransaction(async (tx) => {
      const inserted = await tx.query("INSERT INTO t (a) VALUES (@a) RETURNING id", { a: 2 });
      await tx.query("UPDATE t SET a = 3");
      return inserted.rows[0].id;
    });

    // Assert
    expect(result).toBe(9);
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    expect(db.calls.map((call) => call.text)).toEqual([
      "BEGIN", "INSERT INTO t (a) VALUES (@a) RETURNING id", "UPDATE t SET a = 3", "COMMIT",
    ]);
    expect(db.statements()).toHaveLength(2);
    expect(allParams(db.calls)).toEqual([{ name: "a", value: 2 }]);
  });

  it("records ROLLBACK and rethrows when the transaction fails", async () => {
    // Arrange
    const db = mockDb([new Error("boom")]);

    // Act
    const run = db.withTransaction((tx) => tx.query("DELETE FROM t"));

    // Assert
    await expect(run).rejects.toThrow("boom");
    expect(db.transactionLog()).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("can be reset and extended between tests", async () => {
    // Arrange
    const db = mockDb([rows({ id: 1 })]);
    await db.query("SELECT 1");

    // Act
    db.reset([affected(1)]);
    db.enqueue(affected(2));
    const first = await db.query("SELECT 2");
    const second = await db.query("SELECT 3");

    // Assert
    expect([first.rowCount, second.rowCount]).toEqual([1, 2]);
    expect(db.calls).toHaveLength(2);
    await expect(db.closePool()).resolves.toBeUndefined();
    await expect(db.configure({})).resolves.toBeUndefined();
  });
});
