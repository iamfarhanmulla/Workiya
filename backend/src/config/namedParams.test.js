const { compileNamed } = require("./namedParams");

describe("compileNamed", () => {
  it("numbers parameters in order of first use and reuses the number for a repeated name", () => {
    // Arrange
    const text = "SELECT * FROM t WHERE a = @a AND b = @b OR a2 = @a";

    // Act
    const result = compileNamed(text, { a: 1, b: "x", unused: true });

    // Assert
    expect(result).toEqual({
      text: "SELECT * FROM t WHERE a = $1 AND b = $2 OR a2 = $1",
      values: [1, "x"],
    });
  });

  it("supports casts and never inlines values into the SQL text", () => {
    // Arrange
    const text = "SELECT @id::int AS id, 'x'::text AS t";

    // Act
    const result = compileNamed(text, { id: "1; DROP TABLE users" });

    // Assert
    expect(result.text).toBe("SELECT $1::int AS id, 'x'::text AS t");
    expect(result.values).toEqual(["1; DROP TABLE users"]);
  });

  it("ignores @ inside literals, quoted identifiers, comments, dollar quotes and @@", () => {
    // Arrange
    const text = [
      "SELECT 'mail@example.com', 'it''s @here', \"col@x\"",
      "-- comment @nope",
      "/* block @nope */",
      "$$ body @nope $$, $fn$ @nope $fn$",
      "WHERE tsv @@ q AND id = @id",
    ].join("\n");

    // Act
    const result = compileNamed(text, { id: 7 });

    // Assert
    expect(result.values).toEqual([7]);
    expect(result.text).toContain("id = $1");
    expect(result.text).toContain("'mail@example.com'");
    expect(result.text).toContain("$fn$ @nope $fn$");
    expect(result.text).toContain("tsv @@ q");
  });

  it("throws when a referenced parameter is missing, but accepts explicit null", () => {
    // Arrange
    const text = "UPDATE t SET a = @a WHERE id = @id";

    // Act
    const missing = () => compileNamed(text, { a: 1 });
    const withNull = compileNamed(text, { a: null, id: 2 });

    // Assert
    expect(missing).toThrow('SQL parameter "@id" is missing from params.');
    expect(withNull.values).toEqual([null, 2]);
  });

  it("does not treat inherited properties as parameters and defaults params to {}", () => {
    // Arrange
    const params = Object.create({ id: 1 });

    // Act
    const inherited = () => compileNamed("SELECT @id", params);
    const noParams = compileNamed("SELECT 1");

    // Assert
    expect(inherited).toThrow(/@id/);
    expect(noParams).toEqual({ text: "SELECT 1", values: [] });
  });

  it("keeps compiling correctly after the statement cache is full", () => {
    // Arrange
    const texts = Array.from({ length: 510 }, (_, i) => `SELECT @v AS c${i}`);

    // Act
    const results = texts.map((text) => compileNamed(text, { v: 1 }));
    const again = compileNamed(texts[0], { v: 2 });

    // Assert
    expect(results[509]).toEqual({ text: "SELECT $1 AS c509", values: [1] });
    expect(again).toEqual({ text: "SELECT $1 AS c0", values: [2] });
  });
});
