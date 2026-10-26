const { USERS } = require("./apiHarness");

// Rows as the activity / submission repositories return them (snake_case pg columns).
const NOW = new Date("2026-10-21T10:00:00.000Z");
const ACCOUNT = Object.freeze({ lat: 19.076, lon: 72.8777 });

function activityRow(overrides = {}) {
  return {
    id: 5,
    company_id: 2,
    activity_type_id: 1,
    activity_type_name: "Doctor Visit",
    account_id: 3,
    account_name: "Dr. Rao",
    assigned_to: USERS.employee.id,
    assigned_to_name: "Emp",
    assigned_by: USERS.manager.id,
    assigned_by_name: "Mgr",
    title: "Visit",
    description: null,
    status: "Pending",
    priority: "Medium",
    due_at: null,
    completed_at: null,
    created_at: NOW,
    latest_submission_id: null,
    ...overrides,
  };
}

// findActivityForSubmission / the locked submit row: activity, type rules, account location.
function activityContext(overrides = {}) {
  return {
    id: 5,
    company_id: 2,
    assigned_to: USERS.employee.id,
    status: "InProgress",
    title: "Visit",
    requires_check_in: true,
    geofence_meters: 100,
    min_photos: 0,
    requires_signature: false,
    account_latitude: ACCOUNT.lat,
    account_longitude: ACCOUNT.lon,
    ...overrides,
  };
}

function submissionRow(overrides = {}) {
  return {
    id: 40,
    company_id: 2,
    activity_id: 5,
    activity_title: "Visit",
    account_name: "Dr. Rao",
    submitted_by: USERS.employee.id,
    submitted_by_name: "Emp",
    check_in_at: NOW,
    check_in_latitude: ACCOUNT.lat,
    check_in_longitude: ACCOUNT.lon,
    check_out_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    photo_url: null,
    signature_url: null,
    notes: "ok",
    rating: 4,
    answers: { met: true },
    review_status: "Pending",
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    review_comment: null,
    submitted_at: NOW,
    ...overrides,
  };
}

// Service call context: { user, ip, userAgent }.
function context(user = USERS.employee) {
  return { user, ip: "10.0.0.1", userAgent: "jest" };
}

module.exports = {
  NOW, ACCOUNT, activityRow, activityContext, submissionRow, context,
};
