const sql = require("mssql");

function getMssqlConfig() {
  return {
    server: process.env.MSSQL_SERVER || "",
    database: process.env.MSSQL_DATABASE || "",
    user: process.env.MSSQL_USER || "",
    password: process.env.MSSQL_PASSWORD || "",
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  };
}

async function connectDb() {
  const config = getMssqlConfig();
  return sql.connect(config);
}

module.exports = {
  sql,
  connectDb,
  getMssqlConfig
};
