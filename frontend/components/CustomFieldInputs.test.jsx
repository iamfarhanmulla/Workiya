import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomFieldInputs, { setFieldValue } from "./CustomFieldInputs";

const FIELDS = [
  {
    fieldKey: "speciality", label: "Speciality", dataType: "TEXT", isRequired: true,
  },
  { fieldKey: "beds", label: "Beds", dataType: "NUMBER" },
  { fieldKey: "since", label: "Since", dataType: "DATE" },
  { fieldKey: "vip", label: "VIP", dataType: "BOOLEAN" },
  {
    fieldKey: "tier", label: "Tier", dataType: "SELECT", options: ["A", "B"],
  },
  {
    fieldKey: "days", label: "Visit days", dataType: "MULTI_SELECT", options: ["Mon", "Tue", "Wed"],
  },
  { fieldKey: "mobile", label: "Mobile", dataType: "PHONE" },
  { fieldKey: "mail", label: "Mail", dataType: "EMAIL" },
];

function Harness({ initial = {}, onChange, errors }) {
  const [values, setValues] = useState(initial);
  return (
    <CustomFieldInputs
      fields={FIELDS}
      values={values}
      errors={errors}
      idPrefix="acc"
      onChange={(next) => {
        setValues(next);
        onChange(next);
      }}
    />
  );
}

function lastValues(onChange) {
  return onChange.mock.calls.at(-1)[0];
}

describe("setFieldValue", () => {
  it("sets a value and removes empty ones", () => {
    // Arrange
    const values = { a: "x", b: "y" };

    // Act
    const next = setFieldValue(setFieldValue(values, "a", ""), "c", ["z"]);
    const cleared = setFieldValue(null, "d", []);

    // Assert
    expect(next).toEqual({ b: "y", c: ["z"] });
    expect(values).toEqual({ a: "x", b: "y" });
    expect(cleared).toEqual({});
  });
});

describe("CustomFieldInputs", () => {
  it("renders a labelled input of the right type for each field", () => {
    // Arrange
    const onChange = jest.fn();

    // Act
    render(<Harness onChange={onChange} />);

    // Assert
    expect(screen.getByLabelText("Speciality *")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Speciality *")).toHaveAttribute("id", "acc-speciality");
    expect(screen.getByLabelText("Beds")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Since")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("VIP")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("Tier").tagName).toBe("SELECT");
    expect(screen.getByRole("group", { name: "Visit days" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("Mail")).toHaveAttribute("type", "email");
  });

  it("reports text, number, boolean and select changes", async () => {
    // Arrange
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    // Act
    await user.type(screen.getByLabelText("Speciality *"), "Cardio");
    await user.type(screen.getByLabelText("Beds"), "12");
    await user.click(screen.getByLabelText("VIP"));
    await user.selectOptions(screen.getByLabelText("Tier"), "B");

    // Assert
    expect(lastValues(onChange)).toEqual({
      speciality: "Cardio", beds: 12, vip: true, tier: "B",
    });
  });

  it("keeps multi-select values in option order and drops cleared fields", async () => {
    // Arrange
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness initial={{ speciality: "X", tier: "A" }} onChange={onChange} />);

    // Act
    await user.click(screen.getByLabelText("Wed"));
    await user.click(screen.getByLabelText("Mon"));
    await user.clear(screen.getByLabelText("Speciality *"));
    await user.selectOptions(screen.getByLabelText("Tier"), "");

    // Assert
    expect(lastValues(onChange)).toEqual({ days: ["Mon", "Wed"] });
  });

  it("removes a multi-select value when unticked and the key when none are left", async () => {
    // Arrange
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness initial={{ days: ["Tue"] }} onChange={onChange} />);

    // Act
    await user.click(screen.getByLabelText("Tue"));

    // Assert
    expect(screen.getByLabelText("Tue")).not.toBeChecked();
    expect(lastValues(onChange)).toEqual({});
  });

  it("shows field errors linked to their inputs", () => {
    // Arrange
    const errors = { speciality: "Speciality is required", vip: "Pick one", days: "Too many" };

    // Act
    render(<Harness onChange={jest.fn()} errors={errors} />);

    // Assert
    const input = screen.getByLabelText("Speciality *");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "acc-speciality-error");
    const message = screen.getByText("Speciality is required");
    expect(message).toHaveAttribute("id", "acc-speciality-error");
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    expect(screen.getByText("Too many")).toBeInTheDocument();
    expect(screen.getByLabelText("Beds")).not.toHaveAttribute("aria-invalid");
  });

  it("renders nothing without fields and tolerates missing values and options", () => {
    // Arrange
    const fields = [{ fieldKey: "pick", label: "Pick", dataType: "SELECT" }];

    // Act
    const { container, rerender } = render(<CustomFieldInputs fields={[]} onChange={jest.fn()} />);
    const emptyHtml = container.innerHTML;
    rerender(<CustomFieldInputs fields={fields} values={null} onChange={jest.fn()} />);

    // Assert
    expect(emptyHtml).toBe("");
    expect(screen.getByLabelText("Pick")).toHaveAttribute("id", "custom-field-pick");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});
