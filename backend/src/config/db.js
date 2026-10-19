const sql = require("mssql");
const config = require("./env");

let poolPromise = null;

function getMssqlConfig() {
  return {
    server: config.mssql.server,
    database: config.mssql.database,
    user: config.mssql.user,
    password: config.mssql.password,
    options: {
      encrypt: true,
      trustServerCertificate: config.mssql.trustServerCertificate,
    },
  };
}

function connectDb() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getMssqlConfig())
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = {
  sql,
  connectDb,
  getMssqlConfig,
};
