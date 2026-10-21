import activateOnKey from "./activateOnKey";

function keyEvent(key) {
  return {
    key,
    preventDefault: jest.fn(),
    currentTarget: { click: jest.fn() },
  };
}

describe("activateOnKey", () => {
  it.each(["Enter", " "])("clicks the element when %p is pressed", (key) => {
    // Arrange
    const event = keyEvent(key);

    // Act
    activateOnKey(event);

    // Assert
    expect(event.currentTarget.click).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it.each(["Tab", "Escape", "a"])("ignores %p", (key) => {
    // Arrange
    const event = keyEvent(key);

    // Act
    activateOnKey(event);

    // Assert
    expect(event.currentTarget.click).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
