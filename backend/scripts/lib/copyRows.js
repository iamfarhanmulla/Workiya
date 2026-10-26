// Pure row logic for the SQL Server -> PostgreSQL copy: converting source rows, finding rows
// the new same-company rules reject, and comparing copied rows with what the target holds.
// Nothing here prints row values: reports carry table names, ids and column names only.
const { ConversionError } = require("./copyConverters");

const SUPER_ADMIN_CODE = "SUPER_ADMIN";

// Converts the source rows of one table. Conversion problems are collected, not thrown.
function convertRows(spec, sourceRows) {
  const rows = [];
  const errors = [];
  sourceRows.forEach((sourceRow) => {
    const row = {};
    spec.columns.forEach((column) => {
      try {
        row[column.target] = column.convert(sourceRow[column.source], sourceRow);
      } catch (err) {
        if (!(err instanceof ConversionError)) {
          throw err;
        }
        errors.push({ id: sourceRow.Id, column: column.target, reason: err.message });
      }
    });
    rows.push(row);
  });
  return { rows, errors };
}

function foreignUserReason(row, column, usersCompany) {
  const owner = usersCompany.get(row[column]);
  return `${column} user ${row[column]} belongs to company ${owner ?? "(none)"},`
    + ` not ${row.company_id}`;
}

// Why a row cannot be copied under the PostgreSQL rules, or null when it can.
// context: usersCompany (user id -> company id), superAdmins (Set of user ids) and
// skippedIds (table -> Set of skipped ids).
function rejectReason(spec, row, { usersCompany, superAdmins, skippedIds }) {
  if (spec.historyOf && skippedIds.get(spec.historyOf)?.has(row.id)) {
    return `${spec.historyOf} id ${row.id} is not copied`;
  }
  const parent = Object.entries(spec.parents)
    .find(([column, parentTable]) => skippedIds.get(parentTable)?.has(row[column]));
  if (parent) {
    return `${parent[0]} ${row[parent[0]]} is not copied`;
  }
  const inOtherCompany = (name) => row[name] !== null
    && usersCompany.get(row[name]) !== row.company_id;
  const column = spec.sameCompanyUsers.find(inOtherCompany)
    ?? spec.sameCompanyActors.find((name) => inOtherCompany(name)
      && !superAdmins.has(row[name]));
  return column ? foreignUserReason(row, column, usersCompany) : null;
}

// Remembers what later tables are checked against: SUPER_ADMIN roles, then each user's
// company and which users are super admins.
function rememberReferences(spec, rows, context) {
  if (spec.target === "roles") {
    rows.filter((row) => row.code === SUPER_ADMIN_CODE)
      .forEach((row) => context.superAdminRoles.add(row.id));
  }
  if (spec.target === "users") {
    rows.forEach((row) => {
      context.usersCompany.set(row.id, row.company_id);
      if (context.superAdminRoles.has(row.role_id)) {
        context.superAdmins.add(row.id);
      }
    });
  }
}

// How a skipped row is named in reports: its id, plus the version end for history rows.
function rowLabel(spec, row) {
  return spec.historyOf && row.valid_to instanceof Date
    ? `${row.id} (version until ${row.valid_to.toISOString()})`
    : String(row.id);
}

// Plans one table: converted rows to copy plus rows rejected by the skip rules.
function planTable(spec, sourceRows, context) {
  const { rows, errors } = convertRows(spec, sourceRows);
  const copy = [];
  const rejected = [];
  rows.forEach((row) => {
    const reason = rejectReason(spec, row, context);
    if (reason) {
      rejected.push({ id: row.id, label: rowLabel(spec, row), reason });
    } else {
      copy.push(row);
    }
  });
  context.skippedIds.set(spec.target, new Set(rejected.map((item) => item.id)));
  rememberReferences(spec, rows, context);
  return {
    spec, sourceCount: sourceRows.length, rows: copy, rejected, errors,
  };
}

function newPlanContext() {
  return {
    usersCompany: new Map(),
    superAdminRoles: new Set(),
    superAdmins: new Set(),
    skippedIds: new Map(),
  };
}

// Plans every table in order. readRows(spec) resolves the source rows of a table.
async function buildPlan(tables, readRows) {
  const context = newPlanContext();
  const plan = [];
  // eslint-disable-next-line no-restricted-syntax -- tables are read one after another
  for (const spec of tables) {
    // eslint-disable-next-line no-await-in-loop -- later tables depend on earlier plans
    plan.push(planTable(spec, await readRows(spec), context));
  }
  return plan;
}

// A comparable form of a value: Dates as ISO text, numeric strings untouched.
function normalise(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function compareKeys(left, right, columns) {
  const column = columns.find((name) => normalise(left[name]) !== normalise(right[name]));
  if (!column) {
    return 0;
  }
  return normalise(left[column]) < normalise(right[column]) ? -1 : 1;
}

function sortRows(rows, orderBy) {
  return [...rows].sort((left, right) => compareKeys(left, right, orderBy));
}

// Compares the planned rows of a table with the rows read back from the target.
// Returns { expected, actual, checked, mismatches: [{ id, columns }] }.
function compareTable(entry, targetRows) {
  const { spec } = entry;
  const columns = [...spec.orderBy, ...spec.verify];
  const expected = sortRows(entry.rows, spec.orderBy);
  const actual = sortRows(targetRows, spec.orderBy);
  const mismatches = [];
  expected.forEach((row, index) => {
    const other = actual[index] || {};
    const differing = columns.filter((name) => normalise(row[name]) !== normalise(other[name]));
    if (differing.length > 0) {
      mismatches.push({ id: row.id, columns: differing });
    }
  });
  return {
    expected: expected.length,
    actual: actual.length,
    checked: Math.min(expected.length, actual.length),
    mismatches,
  };
}

function isTableVerified(result) {
  return result.expected === result.actual && result.mismatches.length === 0;
}

module.exports = {
  convertRows,
  rejectReason,
  planTable,
  newPlanContext,
  buildPlan,
  normalise,
  sortRows,
  compareTable,
  isTableVerified,
};
