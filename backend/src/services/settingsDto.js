const { toOptionList } = require("./customFields.service");

const TERM_DEFAULTS = Object.freeze({
  "account.singular": "Account",
  "account.plural": "Accounts",
  "activity.singular": "Activity",
  "activity.plural": "Activities",
  "submission.singular": "Submission",
  "submission.plural": "Submissions",
  "rep.singular": "Rep",
  "rep.plural": "Reps",
});

const TERM_KEYS = Object.freeze(Object.keys(TERM_DEFAULTS));

function toTerminologyDto(rows) {
  const labels = { ...TERM_DEFAULTS };
  rows.forEach((row) => {
    if (TERM_KEYS.includes(row.term_key)) {
      labels[row.term_key] = row.label;
    }
  });
  return labels;
}

function toCustomFieldDto(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    fieldKey: row.field_key,
    label: row.label,
    dataType: row.data_type,
    isRequired: Boolean(row.is_required),
    options: row.options_json ? toOptionList(row.options_json) : null,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
  };
}

function toActivityTypeDto(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    requiresCheckIn: Boolean(row.requires_check_in),
    geofenceMeters: row.geofence_meters ?? null,
    minPhotos: row.min_photos,
    requiresSignature: Boolean(row.requires_signature),
    requiresCustomerOtp: Boolean(row.requires_customer_otp),
    isActive: Boolean(row.is_active),
  };
}

module.exports = {
  TERM_DEFAULTS, TERM_KEYS, toTerminologyDto, toCustomFieldDto, toActivityTypeDto,
};
