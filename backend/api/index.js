// Vercel entry point: the Express app runs as one serverless function. backend/vercel.json
// sends every path to it, and Express routes /api/v1/... exactly as on a normal server
// (src/server.js is only used for local development).
module.exports = require("../src/app");
