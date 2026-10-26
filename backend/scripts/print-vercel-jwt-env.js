// Prints JWT_PRIVATE_KEY and JWT_PUBLIC_KEY (base64 PEM) to paste into the Vercel backend
// project's Environment Variables. Run it yourself in your own terminal; the output is a
// secret: never commit it, paste it in chat or share it.
//   node scripts/print-vercel-jwt-env.js
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  ["JWT_PRIVATE_KEY", "jwt-private.pem"],
  ["JWT_PUBLIC_KEY", "jwt-public.pem"],
];

function toEnvLines(keysDir) {
  return KEYS.map(([name, file]) => {
    // eslint-disable-next-line n/no-sync -- one-shot CLI script
    const pem = fs.readFileSync(path.join(keysDir, file), "utf8");
    return `${name}=${Buffer.from(pem, "utf8").toString("base64")}`;
  });
}

if (require.main === module) {
  const keysDir = path.resolve(__dirname, "..", "keys");
  process.stdout.write("Paste each line into Vercel (backend project > Settings > "
    + "Environment Variables). Keep them secret.\n\n");
  process.stdout.write(`${toEnvLines(keysDir).join("\n\n")}\n`);
}

module.exports = { toEnvLines };
