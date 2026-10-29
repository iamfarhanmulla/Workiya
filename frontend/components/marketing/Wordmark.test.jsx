import { render, screen, waitFor } from "@testing-library/react";
import Wordmark from "./Wordmark";

describe("Wordmark", () => {
  it("names the logo for screen readers and adds the swoosh and dot once fonts load", async () => {
    // Arrange
    const label = "WorKiya";

    // Act
    const { container } = render(<Wordmark size={30} animate />);

    // Assert
    expect(screen.getByRole("img", { name: label })).toHaveClass("wm", "anim");
    await waitFor(() => expect(container.querySelector(".swoosh path")).toHaveAttribute("d"));
    expect(container.querySelector(".dot")).toBeInTheDocument();
  });

  it("uses the white variant on dark backgrounds", () => {
    // Arrange
    const props = { size: 26, light: true, label: "WorKiya footer" };

    // Act
    render(<Wordmark size={props.size} light={props.light} label={props.label} />);

    // Assert
    expect(screen.getByRole("img", { name: props.label })).toHaveClass("light");
  });
});
