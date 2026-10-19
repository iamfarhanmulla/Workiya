const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEYS_DIR = path.resolve(__dirname, "..", "keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "jwt-private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "jwt-public.pem");

function main() {
  const force = process.argv.includes("--force");
  const exists = fs.existsSync(PRIVATE_KEY_PATH) || fs.existsSync(PUBLIC_KEY_PATH);
  if (exists && !force) {
    process.stderr.write(`JWT keys already exist in ${KEYS_DIR}. Re-run with --force to overwrite.\n`);
    process.exitCode = 1;
    return;
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
  process.stdout.write(`Wrote ${PRIVATE_KEY_PATH} and ${PUBLIC_KEY_PATH}\n`);
}

main();
