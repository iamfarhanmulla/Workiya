const { mockPool } = require("./apiHarness");

// apiHarness.mockPool plus pool.transaction(): requests made inside a transaction share the same
// response queue, and begin/commit/rollback calls are recorded in order in `tx`.
async function mockTransactionalPool(connectDb, responses = []) {
  const { queries } = mockPool(connectDb, responses);
  const pool = await connectDb();
  connectDb.mockClear();
  const tx = [];
  pool.transaction = () => ({
    begin: async () => tx.push("begin"),
    commit: async () => tx.push("commit"),
    rollback: async () => tx.push("rollback"),
    request: () => pool.request(),
  });
  return { queries, tx };
}

// Every { name, value } bound across all recorded queries.
function allInputs(queries) {
  return queries.flatMap((query) => Object.entries(query.inputs)
    .map(([name, value]) => ({ name, value })));
}

module.exports = { mockTransactionalPool, allInputs };
