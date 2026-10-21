const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const config = require("../config/env");

const ALGORITHM = "RS256";

function signAccessToken(userDto) {
  const claims = {
    cid: userDto.companyId,
    rid: userDto.roleId,
    role: userDto.roleCode,
  };
  return jwt.sign(claims, config.jwt.privateKey, {
    algorithm: ALGORITHM,
    subject: String(userDto.id),
    jwtid: crypto.randomUUID(),
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.accessTtlSeconds,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.publicKey, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken,
};
