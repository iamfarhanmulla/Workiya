const { compileNamed } = require("../../src/config/namedParams");
const dbErrors = require("../../src/config/dbErrors");

const TX_MARKERS = new Set(["BEGIN", "COMMIT", "ROLLBACK"]);

// pg-style results, as returned by config/db query().
function rows(...list) {
  return { rows: list, rowCount: list.length };
}

function affected(count) {
  return { rows: [], rowCount: count };
}

const EMPTY = Object.freeze(affected(0));

// Fake of src/config/db.js for unit tests. Usage:
//   jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());
//   const db = require("../config/db");
//   db.reset([rows({ id: 1 }), new Error("boom")]);
// Answers query() / tx.query() in order from the queue (an Error entry is thrown; an empty
// queue answers { rows: [], rowCount: 0 }). `calls` records { text, params } for every query,
// with "BEGIN" / "COMMIT" / "ROLLBACK" entries for withTransaction, all in order. Named
// parameters are checked like the real helper: a missing "@name" throws.
function mockDb(responses = []) {
  const queue = [...responses];
  const calls = [];

  async function answer(text, params) {
    calls.push({ text, params: { ...params } });
    compileNamed(text, params);
    const next = queue.length > 0 ? queue.shift() : EMPTY;
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }

  function mark(text) {
    calls.push({ text, params: {} });
  }

  const withTransaction = jest.fn(async (work) => {
    mark("BEGIN");
    try {
      const result = await work({ query: (text, params = {}) => answer(text, params) });
      mark("COMMIT");
      return result;
    } catch (err) {
      mark("ROLLBACK");
      throw err;
    }
  });

  return {
    ...dbErrors,
    query: jest.fn((text, params = {}) => answer(text, params)),
    withTransaction,
    getPool: jest.fn(),
    closePool: jest.fn(async () => {}),
    configure: jest.fn(async () => {}),
    createPool: jest.fn(),
    calls,
    // Replaces the queued responses and forgets recorded calls.
    reset(next = []) {
      queue.splice(0, queue.length, ...next);
      calls.splice(0, calls.length);
    },
    // Adds responses to the end of the queue.
    enqueue(...next) {
      queue.push(...next);
    },
    // Recorded SQL calls without the BEGIN / COMMIT / ROLLBACK markers.
    statements() {
      return calls.filter((call) => !TX_MARKERS.has(call.text));
    },
    // The BEGIN / COMMIT / ROLLBACK markers, in order.
    transactionLog() {
      return calls.filter((call) => TX_MARKERS.has(call.text)).map((call) => call.text);
    },
  };
}

// Every { name, value } bound across the given calls (e.g. db.calls).
function allParams(calls) {
  return calls.flatMap((call) => Object.entries(call.params)
    .map(([name, value]) => ({ name, value })));
}

module.exports = {
  mockDb, rows, affected, allParams,
};
