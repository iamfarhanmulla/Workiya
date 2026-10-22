import { api } from "@/lib/apiClient";
import {
  listCustomFields, parseOptions, saveCustomField, toCamelKey, toUpperSnake,
} from "./settingsApi";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

describe("settingsApi helpers", () => {
  it.each([
    ["Hospital Name", "hospitalName"],
    ["  visit   PURPOSE (main) ", "visitPurposeMain"],
    ["2nd phone", "ndPhone"],
    ["", ""],
  ])("toCamelKey(%p) -> %p", (input, expected) => {
    // Arrange / Act
    const result = toCamelKey(input);

    // Assert
    expect(result).toBe(expected);
  });

  it("toUpperSnake turns a name into a code", () => {
    // Arrange / Act
    const result = toUpperSnake("Doctor visit - follow up");

    // Assert
    expect(result).toBe("DOCTOR_VISIT_FOLLOW_UP");
  });

  it("parseOptions trims, drops empties and removes duplicates", () => {
    // Arrange / Act
    const result = parseOptions(" A, B ,, A ,C");

    // Assert
    expect(result).toEqual(["A", "B", "C"]);
  });
});

describe("settingsApi requests", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists custom fields including inactive ones for the chosen company", async () => {
    // Arrange
    api.get.mockResolvedValue({ data: { success: true, data: [{ id: 1 }] } });

    // Act
    const result = await listCustomFields("SUBMISSION", 7);

    // Assert
    expect(result).toEqual([{ id: 1 }]);
    expect(api.get).toHaveBeenCalledWith("/settings/custom-fields", {
      params: { companyId: 7, entityType: "SUBMISSION", includeInactive: true },
    });
  });

  it("does not add companyId to an update body", async () => {
    // Arrange
    api.put.mockResolvedValue({ data: { success: true, data: { id: 2 } } });

    // Act
    await saveCustomField(2, { label: "X" }, 7);

    // Assert
    expect(api.put).toHaveBeenCalledWith(
      "/settings/custom-fields/2",
      { label: "X" },
      { params: { companyId: 7 } },
    );
  });
});
