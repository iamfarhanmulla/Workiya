/* eslint-disable n/no-sync -- test fixture files in a temp folder; sync keeps the test simple */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { toEnvLines } = require("./print-vercel-jwt-env");

describe("print-vercel-jwt-env", () => {
  it("encodes both PEM files as base64 env lines that decode back to the PEM", () => {
    // Arrange
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jwtkeys-"));
    fs.writeFileSync(path.join(dir, "jwt-private.pem"), "-----PRIVATE-----\nabc\n");
    fs.writeFileSync(path.join(dir, "jwt-public.pem"), "-----PUBLIC-----\nxyz\n");

    // Act
    const lines = toEnvLines(dir);

    // Assert
    expect(lines).toHaveLength(2);
    const separator = lines[0].indexOf("=");
    const privateValue = lines[0].slice(separator + 1);
    expect(lines[0].slice(0, separator)).toBe("JWT_PRIVATE_KEY");
    expect(Buffer.from(privateValue, "base64").toString("utf8")).toBe("-----PRIVATE-----\nabc\n");
    expect(lines[1].startsWith("JWT_PUBLIC_KEY=")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
