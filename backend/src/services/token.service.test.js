const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const tokenService = require("./token.service");

const user = {
  id: 7, companyId: 3, roleId: 2, roleCode: "ADMIN",
};

describe("token.service", () => {
  it("signs an RS256 access token with the expected claims", () => {
    // Arrange / Act
    const token = tokenService.signAccessToken(user);
    const decoded = jwt.decode(token, { complete: true });

    // Assert
    expect(decoded.header.alg).toBe("RS256");
    expect(decoded.payload).toMatchObject({
      sub: "7",
      cid: 3,
      rid: 2,
      role: "ADMIN",
      iss: "workiya-api",
      aud: "workiya-web",
    });
    expect(decoded.payload.jti).toEqual(expect.any(String));
    expect(decoded.payload.exp - decoded.payload.iat).toBe(900);
  });

  it("verifies a token it signed", () => {
    // Arrange
    const token = tokenService.signAccessToken(user);

    // Act
    const claims = tokenService.verifyAccessToken(token);

    // Assert
    expect(claims.sub).toBe("7");
  });

  it("rejects an HS256 token signed with the public key (algorithm confusion)", () => {
    // Arrange
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
      sub: "1",
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
      exp: now + 60,
    })}`;
    const signature = crypto.createHmac("sha256", config.jwt.publicKey)
      .update(unsigned)
      .digest("base64url");
    const forged = `${unsigned}.${signature}`;

    // Act / Assert
    expect(() => tokenService.verifyAccessToken(forged)).toThrow();
  });

  it("rejects tokens with the wrong issuer or audience", () => {
    // Arrange
    const wrongIssuer = jwt.sign({ sub: "1" }, config.jwt.privateKey, {
      algorithm: "RS256",
      issuer: "someone-else",
      audience: config.jwt.audience,
    });
    const wrongAudience = jwt.sign({ sub: "1" }, config.jwt.privateKey, {
      algorithm: "RS256",
      issuer: config.jwt.issuer,
      audience: "other-app",
    });

    // Act / Assert
    expect(() => tokenService.verifyAccessToken(wrongIssuer)).toThrow(/issuer/);
    expect(() => tokenService.verifyAccessToken(wrongAudience)).toThrow(/audience/);
  });

  it("generates 32-byte base64url refresh tokens that are unique", () => {
    // Arrange / Act
    const first = tokenService.generateRefreshToken();
    const second = tokenService.generateRefreshToken();

    // Assert
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
  });

  it("hashes refresh tokens with sha256 hex", () => {
    // Arrange
    const token = "abc";
    const expected = crypto.createHash("sha256").update(token).digest("hex");

    // Act
    const hash = tokenService.hashRefreshToken(token);

    // Assert
    expect(hash).toBe(expected);
    expect(hash).toHaveLength(64);
  });
});
