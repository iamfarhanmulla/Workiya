jest.mock("../repositories/customField.repository", () => ({ list: jest.fn() }));

const customFieldRepository = require("../repositories/customField.repository");
const { validateValues, parseOptions } = require("./customFields.service");

function definition(fieldKey, dataType, extra = {}) {
  return {
    FieldKey: fieldKey,
    Label: extra.Label || fieldKey,
    DataType: dataType,
    IsRequired: extra.IsRequired || false,
    OptionsJson: extra.OptionsJson || null,
  };
}

const COLORS = JSON.stringify(["Red", "Green", "Blue"]);

const ALL_TYPES = [
  definition("note", "TEXT"),
  definition("beds", "NUMBER"),
  definition("since", "DATE"),
  definition("vip", "BOOLEAN"),
  definition("color", "SELECT", { OptionsJson: COLORS }),
  definition("colors", "MULTI_SELECT", { OptionsJson: COLORS }),
  definition("phone", "PHONE"),
  definition("mail", "EMAIL"),
];

describe("customFields.service.validateValues", () => {
  beforeEach(() => {
    customFieldRepository.list.mockResolvedValue(ALL_TYPES);
  });

  it("accepts a valid value for every data type and asks for active ACCOUNT fields", async () => {
    // Arrange
    const values = {
      note: "Hello",
      beds: 12.5,
      since: "2024-02-29",
      vip: false,
      color: "Red",
      colors: ["Red", "Blue", "Red"],
      phone: "+91 (22) 555-0100",
      mail: "a@b.co",
    };

    // Act
    const result = await validateValues(7, "ACCOUNT", values);

    // Assert
    expect(customFieldRepository.list).toHaveBeenCalledWith(7, { entityType: "ACCOUNT" });
    expect(result).toEqual({ ok: true, value: { ...values, colors: ["Red", "Blue"] } });
  });

  it.each([
    ["note", "x".repeat(1001)],
    ["note", 5],
    ["beds", "12"],
    ["beds", Number.POSITIVE_INFINITY],
    ["since", "2024-13-01"],
    ["since", "2023-02-29"],
    ["since", "01/02/2024"],
    ["vip", "true"],
    ["color", "Purple"],
    ["colors", ["Red", "Purple"]],
    ["colors", "Red"],
    ["phone", "12ab"],
    ["phone", "123"],
    ["mail", "not-an-email"],
    ["mail", `${"a".repeat(320)}@b.co`],
  ])("rejects %s = %p", async (key, value) => {
    // Arrange
    const values = { [key]: value };

    // Act
    const result = await validateValues(7, "ACCOUNT", values);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(new RegExp(`^${key} must be`));
  });

  it("rejects unknown keys", async () => {
    // Arrange
    const values = { note: "ok", ghost: 1, other: 2 };

    // Act
    const result = await validateValues(7, "SUBMISSION", values);

    // Assert
    expect(result).toEqual({ ok: false, message: "Unknown field(s): ghost, other." });
  });

  it.each([undefined, null, "", []])("requires a required field (value %p)", async (value) => {
    // Arrange
    customFieldRepository.list.mockResolvedValue([
      definition("spec", "TEXT", { Label: "Speciality", IsRequired: true }),
    ]);

    // Act
    const result = await validateValues(7, "ACCOUNT", { spec: value });

    // Assert
    expect(result).toEqual({ ok: false, message: "Speciality is required." });
  });

  it("treats null/undefined as {} and drops empty optional fields", async () => {
    // Arrange / Act
    const fromNull = await validateValues(7, "ACCOUNT", null);
    const fromUndefined = await validateValues(7, "ACCOUNT", undefined);
    const withBlanks = await validateValues(7, "ACCOUNT", { note: "", colors: [], beds: null });

    // Assert
    expect(fromNull).toEqual({ ok: true, value: {} });
    expect(fromUndefined).toEqual({ ok: true, value: {} });
    expect(withBlanks).toEqual({ ok: true, value: {} });
  });

  it.each([["a string"], [[1, 2]], [42], [new Date()]])("rejects non-object %p", async (values) => {
    // Arrange / Act
    const result = await validateValues(7, "ACCOUNT", values);

    // Assert
    expect(result).toEqual({ ok: false, message: "Custom field values must be an object." });
    expect(customFieldRepository.list).not.toHaveBeenCalled();
  });

  it("joins several errors into one message", async () => {
    // Arrange
    customFieldRepository.list.mockResolvedValue([
      definition("a", "NUMBER", { Label: "A" }),
      definition("b", "BOOLEAN", { Label: "B", IsRequired: true }),
    ]);

    // Act
    const result = await validateValues(7, "ACCOUNT", { a: "x" });

    // Assert
    expect(result).toEqual({ ok: false, message: "A must be a number. B is required." });
  });

  it("rejects every value for a SELECT field with broken or unknown options and type", async () => {
    // Arrange
    customFieldRepository.list.mockResolvedValue([
      definition("pick", "SELECT", { OptionsJson: "not json" }),
      definition("odd", "UNKNOWN_TYPE"),
    ]);

    // Act
    const pick = await validateValues(7, "ACCOUNT", { pick: "Red" });
    const odd = await validateValues(7, "ACCOUNT", { odd: "x" });

    // Assert
    expect(pick).toEqual({ ok: false, message: "pick must be one of the listed options." });
    expect(odd).toEqual({ ok: false, message: "odd must be a valid value." });
  });
});

describe("customFields.service.validateValues with stored values", () => {
  beforeEach(() => {
    customFieldRepository.list.mockResolvedValue([definition("note", "TEXT")]);
  });

  it("keeps stored values of fields that are no longer active", async () => {
    // Arrange
    const existing = { note: "old", hospital: "City Hospital" };

    // Act
    const result = await validateValues(7, "ACCOUNT", { note: "new" }, { existing });

    // Assert
    expect(result).toEqual({ ok: true, value: { hospital: "City Hospital", note: "new" } });
  });

  it("keeps the stored active values when no values are sent", async () => {
    // Arrange
    const existing = { note: "old", hospital: "City Hospital" };

    // Act
    const result = await validateValues(7, "ACCOUNT", undefined, { existing });

    // Assert
    expect(result).toEqual({ ok: true, value: { hospital: "City Hospital", note: "old" } });
  });

  it("clears active values when null is sent but still keeps inactive ones", async () => {
    // Arrange
    const existing = { note: "old", hospital: "City Hospital" };

    // Act
    const result = await validateValues(7, "ACCOUNT", null, { existing });

    // Assert
    expect(result).toEqual({ ok: true, value: { hospital: "City Hospital" } });
  });

  it("still rejects a value sent for a field that is not active", async () => {
    // Arrange
    const existing = { hospital: "City Hospital" };

    // Act
    const result = await validateValues(7, "ACCOUNT", { hospital: "Other" }, { existing });

    // Assert
    expect(result).toEqual({ ok: false, message: "Unknown field(s): hospital." });
  });
});

describe("customFields.service.validateValues with prototype-like keys", () => {
  it("does not read an omitted field named like an Object.prototype member", async () => {
    // Arrange
    customFieldRepository.list.mockResolvedValue([
      definition("toString", "TEXT"), definition("constructor", "TEXT"),
    ]);

    // Act
    const result = await validateValues(7, "ACCOUNT", {});

    // Assert
    expect(result).toEqual({ ok: true, value: {} });
  });

  it("stores a __proto__ key as an own value without touching the prototype", async () => {
    // Arrange
    customFieldRepository.list.mockResolvedValue([definition("__proto__", "TEXT")]);
    const values = JSON.parse("{\"__proto__\": \"x\"}");

    // Act
    const result = await validateValues(7, "ACCOUNT", values);

    // Assert
    expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(result.value)).toContain("__proto__");
  });
});

describe("customFields.service.parseOptions", () => {
  it.each([
    [null, []],
    ["", []],
    ["{\"a\":1}", []],
    ["[1,\"b\"]", ["1", "b"]],
    ["oops", []],
  ])("parseOptions(%p) is %p", (input, expected) => {
    // Arrange / Act
    const result = parseOptions(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
