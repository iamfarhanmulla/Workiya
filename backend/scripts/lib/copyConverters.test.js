const {
  ConversionError, asIs, toInteger, utc, updatedAt, json, jsonObject, jsonOrString,
} = require("./copyConverters");

describe("copyConverters", () => {
  it("converts dates to UTC Date copies and rejects invalid dates", () => {
    // Arrange
    const source = new Date("2026-10-21T09:49:26.475Z");

    // Act
    const copied = utc(source);
    const parsed = utc("2026-10-21T15:19:26.475+05:30");

    // Assert
    expect(copied).toEqual(source);
    expect(copied).not.toBe(source);
    expect(parsed.toISOString()).toBe("2026-10-21T09:49:26.475Z");
    expect(utc(null)).toBeNull();
    expect(() => utc("not a date")).toThrow(ConversionError);
  });

  it("falls back to CreatedAtUtc when UpdatedAtUtc is NULL", () => {
    // Arrange
    const created = new Date("2026-04-06T10:19:20.494Z");
    const updated = new Date("2026-04-16T06:49:42.136Z");

    // Act
    const fallback = updatedAt(null, { CreatedAtUtc: created });
    const kept = updatedAt(updated, { CreatedAtUtc: created });

    // Assert
    expect(fallback).toEqual(created);
    expect(kept).toEqual(updated);
  });

  it("turns bigint strings into numbers and undefined into NULL", () => {
    // Arrange / Act / Assert
    expect(toInteger("23")).toBe(23);
    expect(toInteger(null)).toBeNull();
    expect(asIs(undefined)).toBeNull();
    expect(asIs(false)).toBe(false);
  });

  it("normalises JSON text for jsonb, keeping arrays as JSON text", () => {
    // Arrange
    const options = "[ \"A\", \"B\" ]";

    // Act
    const result = json(options);

    // Assert
    expect(result).toBe("[\"A\",\"B\"]");
    expect(json(null)).toBeNull();
  });

  it("rejects invalid JSON without quoting the value", () => {
    // Arrange
    const secretLooking = "{not json secret-value";

    // Act
    const act = () => json(secretLooking);

    // Assert
    expect(act).toThrow(new ConversionError("is not valid JSON"));
  });

  it("accepts only JSON objects for ExtraFields", () => {
    // Arrange / Act / Assert
    expect(jsonObject("{\"a\":1}")).toBe("{\"a\":1}");
    expect(jsonObject(null)).toBeNull();
    expect(() => jsonObject("[1]")).toThrow("is not a JSON object");
    expect(() => jsonObject("null")).toThrow("is not a JSON object");
    expect(() => jsonObject("5")).toThrow("is not a JSON object");
  });

  it("keeps audit values: JSON stays JSON, plain text becomes a JSON string", () => {
    // Arrange / Act / Assert
    expect(jsonOrString("{\"status\":\"Pending\"}")).toBe("{\"status\":\"Pending\"}");
    expect(jsonOrString("plain text")).toBe("\"plain text\"");
    expect(jsonOrString(null)).toBeNull();
  });
});
