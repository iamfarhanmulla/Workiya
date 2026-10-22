const { parseOptions } = require("./customFields.service");

const TERM_DEFAULTS = Object.freeze({
  "account.singular": "Account",
  "account.plural": "Accounts",
  "activity.singular": "Activity",
  "activity.plural": "Activities",
  "submission.singular": "Submission",
  "submission.plural": "Submissions",
});

const TERM_KEYS = Object.freeze(Object.keys(TERM_DEFAULTS));

function toTerminologyDto(rows) {
  const labels = { ...TERM_DEFAULTS };
  rows.forEach((row) => {
    if (TERM_KEYS.includes(row.TermKey)) {
      labels[row.TermKey] = row.Label;
    }
  });
  return labels;
}

function toCustomFieldDto(row) {
  return {
    id: row.Id,
    entityType: row.EntityType,
    fieldKey: row.FieldKey,
    label: row.Label,
    dataType: row.DataType,
    isRequired: Boolean(row.IsRequired),
    options: row.OptionsJson ? parseOptions(row.OptionsJson) : null,
    sortOrder: row.SortOrder,
    isActive: Boolean(row.IsActive),
  };
}

function toActivityTypeDto(row) {
  return {
    id: row.Id,
    code: row.Code,
    name: row.Name,
    requiresCheckIn: Boolean(row.RequiresCheckIn),
    geofenceMeters: row.GeofenceMeters ?? null,
    minPhotos: row.MinPhotos,
    requiresSignature: Boolean(row.RequiresSignature),
    requiresCustomerOtp: Boolean(row.RequiresCustomerOtp),
    isActive: Boolean(row.IsActive),
  };
}

module.exports = {
  TERM_DEFAULTS, TERM_KEYS, toTerminologyDto, toCustomFieldDto, toActivityTypeDto,
};
