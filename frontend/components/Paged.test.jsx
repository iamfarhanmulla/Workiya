import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Paged from "./Paged";

const rows = (n) => Array.from({ length: n }, (_, i) => `Row ${i + 1}`);

function List({ items }) {
  return (
    <Paged items={items}>
      {(pageRows) => <ul>{pageRows.map((r) => <li key={r}>{r}</li>)}</ul>}
    </Paged>
  );
}

function Filterable() {
  const [count, setCount] = useState(40);
  return (
    <>
      <button type="button" onClick={() => setCount(20)}>Filter</button>
      <List items={rows(count)} />
    </>
  );
}

describe("Paged", () => {
  it("shows 15 rows per page and moves between pages", async () => {
    // Arrange
    render(<List items={rows(40)} />);

    // Act
    const firstPage = screen.getAllByRole("listitem").length;
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    // Assert
    expect(firstPage).toBe(15);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Showing 31–40 of 40")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("hides the controls when everything fits on one page", () => {
    // Act
    render(<List items={rows(15)} />);

    // Assert
    expect(screen.getAllByRole("listitem")).toHaveLength(15);
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("goes back to the first page when the list changes", async () => {
    // Arrange
    render(<Filterable />);
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    // Act
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    // Assert
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–15 of 20")).toBeInTheDocument();
  });
});
