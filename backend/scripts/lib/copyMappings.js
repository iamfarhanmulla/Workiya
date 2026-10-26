// Table and column mappings for the one-time SQL Server -> PostgreSQL copy
// (scripts/copy-sqlserver-to-postgres.js). Tables are listed in foreign-key order.
//
// Each column maps a SQL Server column (source) to a PostgreSQL column (target) through a
// converter (value, sourceRow) -> value. Source and target names are fixed here, never taken
// from input, so they may be placed in SQL text. Not copied on purpose: RowVersion,
// Roles.TenantId and the Legacy*Id columns (their tables are not moved), RefreshTokens,
// SchemaMigrations, Doctors, Tasks, TaskFeedback and the other system's tables.

const {
  asIs, toInteger, utc, updatedAt, json, jsonObject, jsonOrString,
} = require("./copyConverters");

const DEFAULT_ORDER = Object.freeze(["id"]);
const HISTORY_ORDER = Object.freeze(["id", "valid_to"]);

function col(source, target, convert = asIs, options = {}) {
  return Object.freeze({
    source, target, convert, jsonb: Boolean(options.jsonb),
  });
}

function jsonCol(source, target, convert) {
  return col(source, target, convert, { jsonb: true });
}

function standardColumns({ by = true } = {}) {
  return [
    col("CreatedAtUtc", "created_at", utc),
    ...(by ? [col("CreatedBy", "created_by")] : []),
    col("UpdatedAtUtc", "updated_at", updatedAt),
    ...(by ? [col("UpdatedBy", "updated_by")] : []),
    col("IsDeleted", "is_deleted"),
  ];
}

const SOFT_DELETE_COLUMNS = Object.freeze([
  col("DeletedAtUtc", "deleted_at", utc), col("DeletedBy", "deleted_by"),
]);

// Skip rules, applied before anything is written (copyRows.rejectReason):
//   parents            column -> table: skip the row when that parent row is not copied;
//   sameCompanyUsers   user columns that must belong to the row's company;
//   sameCompanyActors  user columns that must belong to the row's company unless the user is
//                      a SUPER_ADMIN (the only role that works across companies);
//   historyOf          *_history only: skip versions of rows that are not copied.
function table(spec) {
  return Object.freeze({
    identity: true,
    orderBy: DEFAULT_ORDER,
    deferred: [],
    sameCompanyUsers: [],
    sameCompanyActors: [],
    parents: {},
    historyOf: null,
    ...spec,
  });
}

// The *History table of a SQL Server temporal table: same columns plus ValidToUtc. History
// rows have no keys; versions of rows that are not copied (or whose parent is not copied)
// are left out, so the history never describes rows the target does not hold.
function historyOf(spec, source) {
  return table({
    source,
    target: `${spec.target}_history`,
    identity: false,
    historyOf: spec.target,
    parents: spec.parents,
    orderBy: HISTORY_ORDER,
    columns: [...spec.columns, col("ValidToUtc", "valid_to", utc)],
    verify: ["company_id", "valid_from"],
  });
}

const GENDERS = table({
  source: "Genders",
  target: "genders",
  columns: [
    col("Id", "id"), col("Name", "name"), col("Code", "code"), col("IsActive", "is_active"),
    col("Remarks", "remarks"), ...SOFT_DELETE_COLUMNS, ...standardColumns(),
  ],
  verify: ["code", "name"],
});

const ROLES = table({
  source: "Roles",
  target: "roles",
  columns: [
    col("Id", "id"), col("Name", "name"), col("Code", "code"),
    col("Description", "description"), col("IsActive", "is_active"), col("Remarks", "remarks"),
    ...SOFT_DELETE_COLUMNS, ...standardColumns(),
  ],
  verify: ["code", "name"],
});

const COMPANIES = table({
  source: "Companies",
  target: "companies",
  columns: [
    col("Id", "id"), col("Name", "name"), col("Key", "key"), col("LogoUrl", "logo_url"),
    col("ContactEmail", "contact_email"), col("ContactPhone", "contact_phone"),
    col("Address", "address"), col("City", "city"), col("Country", "country"),
    col("Plan", "plan"), col("Status", "status"), col("IsActive", "is_active"),
    ...standardColumns({ by: false }),
  ],
  verify: ["key", "name"],
});

// manager_id points at other users, so it is written by an UPDATE after every user exists.
const USERS = table({
  source: "Users",
  target: "users",
  deferred: ["manager_id"],
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("Username", "username"),
    col("FirstName", "first_name"), col("MiddleName", "middle_name"),
    col("LastName", "last_name"), col("Email", "email"), col("DisplayName", "display_name"),
    col("GenderId", "gender_id"), col("PhoneNumber", "phone_number"),
    col("AlternatePhoneNumber", "alternate_phone_number"),
    col("PasswordHash", "password_hash"), col("PasswordSalt", "password_salt"),
    col("PasswordIterations", "password_iterations"), col("ManagerId", "manager_id"),
    col("RoleId", "role_id"), col("Status", "status"),
    col("LastLoginUtc", "last_login_at", utc),
    col("FailedLoginCount", "failed_login_count"),
    col("LastFailedLoginUtc", "last_failed_login_at", utc),
    col("LockoutEndUtc", "lockout_end_at", utc),
    col("LastPasswordChangedUtc", "last_password_changed_at", utc),
    col("ProfilePhotoUrl", "profile_photo_url"), col("IsActive", "is_active"),
    col("Remarks", "remarks"), ...SOFT_DELETE_COLUMNS, ...standardColumns(),
  ],
  verify: ["company_id", "email", "role_id", "manager_id"],
});

const COMPANY_TERMINOLOGY = table({
  source: "CompanyTerminology",
  target: "company_terminology",
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("TermKey", "term_key"),
    col("Label", "label"), ...standardColumns(),
  ],
  verify: ["company_id", "term_key", "label"],
});

const CUSTOM_FIELD_DEFINITIONS = table({
  source: "CustomFieldDefinitions",
  target: "custom_field_definitions",
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("EntityType", "entity_type"),
    col("FieldKey", "field_key"), col("Label", "label"), col("DataType", "data_type"),
    col("IsRequired", "is_required"), jsonCol("OptionsJson", "options_json", json),
    col("SortOrder", "sort_order"), col("IsActive", "is_active"), ...standardColumns(),
  ],
  verify: ["company_id", "entity_type", "field_key"],
});

const ACTIVITY_TYPES = table({
  source: "ActivityTypes",
  target: "activity_types",
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("Code", "code"), col("Name", "name"),
    col("RequiresCheckIn", "requires_check_in"), col("GeofenceMeters", "geofence_meters"),
    col("MinPhotos", "min_photos"), col("RequiresSignature", "requires_signature"),
    col("RequiresCustomerOtp", "requires_customer_otp"), col("IsActive", "is_active"),
    ...standardColumns(),
  ],
  verify: ["company_id", "code"],
});

// ValidFromUtc is a hidden period column in SQL Server: it is selected by name.
const VALID_FROM = col("ValidFromUtc", "valid_from", utc);

const ACCOUNTS = table({
  source: "Accounts",
  target: "accounts",
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("Name", "name"),
    col("PhoneNumber", "phone_number"), col("Email", "email"), col("Address", "address"),
    col("City", "city"), col("State", "state"), col("Country", "country"),
    col("Latitude", "latitude"), col("Longitude", "longitude"), col("PhotoUrl", "photo_url"),
    col("Notes", "notes"), jsonCol("ExtraFields", "extra_fields", jsonObject),
    col("IsActive", "is_active"), ...standardColumns(), VALID_FROM,
  ],
  verify: ["company_id", "name", "valid_from"],
});

const ACCOUNT_ASSIGNMENTS = table({
  source: "AccountAssignments",
  target: "account_assignments",
  sameCompanyUsers: ["user_id"],
  parents: { account_id: "accounts" },
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("AccountId", "account_id"),
    col("UserId", "user_id"), col("VisitsPerMonth", "visits_per_month"),
    ...standardColumns(), VALID_FROM,
  ],
  verify: ["company_id", "account_id", "user_id"],
});

const ACTIVITIES = table({
  source: "Activities",
  target: "activities",
  sameCompanyUsers: ["assigned_to"],
  sameCompanyActors: ["assigned_by"],
  parents: { account_id: "accounts", activity_type_id: "activity_types" },
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("ActivityTypeId", "activity_type_id"),
    col("AccountId", "account_id"), col("AssignedTo", "assigned_to"),
    col("AssignedBy", "assigned_by"), col("Title", "title"),
    col("Description", "description"), col("Status", "status"), col("Priority", "priority"),
    col("DueAtUtc", "due_at", utc), col("CompletedAtUtc", "completed_at", utc),
    ...standardColumns(), VALID_FROM,
  ],
  verify: ["company_id", "account_id", "assigned_to", "status"],
});

const SUBMISSIONS = table({
  source: "Submissions",
  target: "submissions",
  sameCompanyUsers: ["submitted_by"],
  parents: { activity_id: "activities" },
  columns: [
    col("Id", "id"), col("CompanyId", "company_id"), col("ActivityId", "activity_id"),
    col("SubmittedBy", "submitted_by"), col("CheckInAtUtc", "check_in_at", utc),
    col("CheckInLatitude", "check_in_latitude"), col("CheckInLongitude", "check_in_longitude"),
    col("CheckOutAtUtc", "check_out_at", utc), col("CheckOutLatitude", "check_out_latitude"),
    col("CheckOutLongitude", "check_out_longitude"), col("PhotoUrl", "photo_url"),
    col("SignatureUrl", "signature_url"),
    col("CustomerOtpVerifiedAtUtc", "customer_otp_verified_at", utc), col("Notes", "notes"),
    col("Rating", "rating"), jsonCol("Answers", "answers", json),
    col("ReviewStatus", "review_status"), col("ReviewedBy", "reviewed_by"),
    col("ReviewedAtUtc", "reviewed_at", utc), col("ReviewComment", "review_comment"),
    col("SubmittedAtUtc", "submitted_at", utc), ...standardColumns(), VALID_FROM,
  ],
  verify: ["company_id", "activity_id", "submitted_by"],
});

const AUDIT_LOGS = table({
  source: "AuditLogs",
  target: "audit_logs",
  columns: [
    col("Id", "id", toInteger), col("EventType", "event_type"),
    col("EntityType", "entity_type"), col("EntityId", "entity_id"),
    col("CompanyId", "company_id"), col("PerformedBy", "performed_by"),
    col("PerformedAtUtc", "performed_at", utc),
    jsonCol("OldValue", "old_value", jsonOrString), jsonCol("NewValue", "new_value", jsonOrString),
    col("IpAddress", "ip_address"), col("UserAgent", "user_agent"),
    col("CreatedAtUtc", "created_at", utc), col("CreatedBy", "created_by"),
  ],
  verify: ["event_type", "entity_type", "performed_at"],
});

const TABLES = Object.freeze([
  GENDERS, ROLES, COMPANIES, USERS, COMPANY_TERMINOLOGY, CUSTOM_FIELD_DEFINITIONS,
  ACTIVITY_TYPES, ACCOUNTS, ACCOUNT_ASSIGNMENTS, ACTIVITIES, SUBMISSIONS, AUDIT_LOGS,
  historyOf(ACCOUNTS, "AccountsHistory"),
  historyOf(ACCOUNT_ASSIGNMENTS, "AccountAssignmentsHistory"),
  historyOf(ACTIVITIES, "ActivitiesHistory"),
  historyOf(SUBMISSIONS, "SubmissionsHistory"),
]);

// Tables whose user triggers (history, valid_from, audit immutability) are switched off while
// the copy writes, so copied history and valid_from values are kept as they are.
const TRIGGER_TABLES = Object.freeze([
  "audit_logs", "accounts", "account_assignments", "activities", "submissions",
]);

// Emptied by --reset. refresh_tokens is not copied (everyone signs in again) but references
// users, so it is cleared with them.
const RESET_TABLES = Object.freeze([
  ...TABLES.map((spec) => spec.target).reverse(), "refresh_tokens",
]);

module.exports = {
  TABLES,
  TRIGGER_TABLES,
  RESET_TABLES,
};
