const {
  accountCreateSchema,
  accountListQuerySchema,
  accountAssignmentsSchema,
  assignmentTransferSchema,
} = require("./account.schemas");

describe("account.schemas", () => {
  it("trims text, turns blanks into null and coerces numeric strings", () => {
    // Arrange
    const body = {
      name: "  Clinic ",
      city: "",
      email: " a@b.co ",
      latitude: "18.5",
      longitude: "",
      companyId: "",
    };

    // Act
    const result = accountCreateSchema.parse(body);

    // Assert
    expect(result).toMatchObject({
      name: "Clinic", city: null, email: "a@b.co", latitude: 18.5, longitude: null, notes: null,
    });
    expect(result.companyId).toBeUndefined();
  });

  it.each([
    [{ name: "A", email: "nope" }],
    [{ name: "A", longitude: 181 }],
    [{ name: "A", latitude: "north" }],
    [{ name: "A".repeat(201) }],
    [{}],
  ])("rejects an invalid account body %#", (body) => {
    // Arrange / Act
    const result = accountCreateSchema.safeParse(body);

    // Assert
    expect(result.success).toBe(false);
  });

  it("applies paging defaults and parses the active filter", () => {
    // Arrange / Act
    const defaults = accountListQuerySchema.parse({});
    const filtered = accountListQuerySchema.parse({
      isActive: "false", companyId: "3", search: " x ",
    });

    // Assert
    expect(defaults).toMatchObject({
      page: 1, pageSize: 50, search: null, isActive: null,
    });
    expect(filtered).toMatchObject({ isActive: false, companyId: 3, search: "x" });
  });

  it("defaults a missing visit target to null and rejects out-of-range ones", () => {
    // Arrange / Act
    const ok = accountAssignmentsSchema.parse({ assignments: [{ userId: 3 }] });
    const bad = accountAssignmentsSchema.safeParse({
      assignments: [{ userId: 3, visitsPerMonth: 32 }],
    });

    // Assert
    expect(ok.assignments).toEqual([{ userId: 3, visitsPerMonth: null }]);
    expect(bad.success).toBe(false);
  });

  it("accepts a transfer between two different users", () => {
    // Arrange / Act
    const result = assignmentTransferSchema.safeParse({ fromUserId: 1, toUserId: 2, companyId: 4 });

    // Assert
    expect(result.success).toBe(true);
  });

  it.each([
    ["javascript:alert(1)"], // eslint-disable-line no-script-url -- the unsafe input under test
    ["data:text/html,x"],
    ["//evil.example/a.png"],
  ])("rejects the unsafe photo URL %p", (photoUrl) => {
    // Arrange / Act
    const result = accountCreateSchema.safeParse({ name: "A", photoUrl });

    // Assert
    expect(result.success).toBe(false);
  });

  it("keeps a safe photo URL and turns a blank one into null", () => {
    // Arrange / Act
    const safe = accountCreateSchema.parse({ name: "A", photoUrl: " https://cdn.example.com/a " });
    const blank = accountCreateSchema.parse({ name: "A", photoUrl: "" });

    // Assert
    expect(safe.photoUrl).toBe("https://cdn.example.com/a");
    expect(blank.photoUrl).toBeNull();
  });
});
