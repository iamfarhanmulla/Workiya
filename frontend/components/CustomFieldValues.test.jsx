import { render, screen } from "@testing-library/react";
import CustomFieldValues, { formatFieldValue } from "./CustomFieldValues";

const FIELDS = [
  { fieldKey: "speciality", label: "Speciality", dataType: "TEXT" },
  { fieldKey: "beds", label: "Beds", dataType: "NUMBER" },
  { fieldKey: "vip", label: "VIP", dataType: "BOOLEAN" },
  { fieldKey: "days", label: "Visit days", dataType: "MULTI_SELECT" },
  { fieldKey: "notes", label: "Notes", dataType: "TEXT" },
];

describe("formatFieldValue", () => {
  it("formats booleans, lists, numbers and empty values", () => {
    // Arrange
    const bool = { dataType: "BOOLEAN" };
    const text = { dataType: "TEXT" };

    // Act
    const results = [
      formatFieldValue(bool, true),
      formatFieldValue(bool, false),
      formatFieldValue(bool, "yes"),
      formatFieldValue(text, ["a", "b"]),
      formatFieldValue(text, 0),
      formatFieldValue(text, ""),
      formatFieldValue(text, []),
      formatFieldValue(text, null),
    ];

    // Assert
    expect(results).toEqual(["Yes", "No", "—", "a, b", "0", "—", "—", "—"]);
  });
});

describe("CustomFieldValues", () => {
  it("lists each field label with its formatted value", () => {
    // Arrange
    const values = {
      speciality: "Cardio", beds: 12, vip: false, days: ["Mon", "Wed"],
    };

    // Act
    render(<CustomFieldValues fields={FIELDS} values={values} />);

    // Assert
    const terms = screen.getAllByRole("term").map((el) => el.textContent);
    const defs = screen.getAllByRole("definition").map((el) => el.textContent);
    expect(terms).toEqual(["Speciality", "Beds", "VIP", "Visit days", "Notes"]);
    expect(defs).toEqual(["Cardio", "12", "No", "Mon, Wed", "—"]);
  });

  it("renders nothing without fields and dashes without values", () => {
    // Arrange
    const fields = [FIELDS[0]];

    // Act
    const { container, rerender } = render(<CustomFieldValues fields={[]} values={{}} />);
    const emptyHtml = container.innerHTML;
    rerender(<CustomFieldValues fields={fields} values={undefined} />);

    // Assert
    expect(emptyHtml).toBe("");
    expect(screen.getByRole("definition")).toHaveTextContent("—");
  });
});
