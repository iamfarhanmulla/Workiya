import { isSafeUrl } from "./safeUrl";

describe("isSafeUrl", () => {
  it.each([
    ["https://cdn.example.com/photo.jpg"],
    ["http://example.com"],
    ["/uploads/photo.jpg"],
  ])("accepts %s", (url) => {
    // Arrange (url from the table)

    // Act
    const result = isSafeUrl(url);

    // Assert
    expect(result).toBe(true);
  });

  it.each([
    ["//attacker.example/login"],
    ["/\\attacker.example"],
    ["https:///attacker.example"],
    ["javascript:alert(1)"], // eslint-disable-line no-script-url -- the unsafe input under test
    ["data:text/html,hi"],
    [""],
    [null],
  ])("refuses %s", (url) => {
    // Arrange (url from the table)

    // Act
    const result = isSafeUrl(url);

    // Assert
    expect(result).toBe(false);
  });
});
