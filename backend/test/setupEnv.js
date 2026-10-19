const crypto = require("crypto");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.JWT_PRIVATE_KEY = Buffer.from(privateKey).toString("base64");
process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString("base64");
process.env.PASSWORD_REHASH_ON_LOGIN = "false";
