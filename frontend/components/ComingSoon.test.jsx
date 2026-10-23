import { render, screen } from "@testing-library/react";
import ComingSoon from "./ComingSoon";

describe("ComingSoon", () => {
  it("says the feature is coming and lists what it will do, with an optional link", () => {
    // Arrange / Act
    render(
      <ComingSoon
        title="Reports"
        sub="Coverage over time"
        icon="monitoring"
        points={["Weekly totals.", "Export to Excel."]}
        link={{ href: "/dashboard", label: "Open the dashboard" }}
      />,
    );

    // Assert
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent))
      .toEqual(["check_circleWeekly totals.", "check_circleExport to Excel."]);
    expect(screen.getByRole("link", { name: "Open the dashboard" }))
      .toHaveAttribute("href", "/dashboard");
  });

  it("shows no link when none is given", () => {
    // Arrange / Act
    render(<ComingSoon title="Leaves" icon="beach_access" points={["Requests."]} />);

    // Assert
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
