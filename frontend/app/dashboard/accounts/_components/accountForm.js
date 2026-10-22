// Form state helpers for the account add/edit modal.

export const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export const PAGE_SIZE = 50;

export const BLANK_FORM = {
  name: "",
  phoneNumber: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "",
  latitude: "",
  longitude: "",
  notes: "",
  photoUrl: "",
  companyId: "",
  extraFields: {},
};

// photoUrl has no input yet; it is carried through so an edit does not clear a stored photo.
const TEXT_KEYS = [
  "name", "phoneNumber", "email", "address", "city", "state", "country", "notes", "photoUrl",
];

function valueOrBlank(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function isStaff(user) {
  return STAFF_ROLES.includes(user?.roleCode);
}

export function toForm(account) {
  const form = { ...BLANK_FORM };
  TEXT_KEYS.forEach((key) => {
    form[key] = valueOrBlank(account[key]);
  });
  form.latitude = valueOrBlank(account.latitude);
  form.longitude = valueOrBlank(account.longitude);
  form.companyId = valueOrBlank(account.companyId);
  form.extraFields = { ...(account.extraFields || {}) };
  return form;
}

function toNumberOrNull(value) {
  const trimmed = String(value).trim();
  return trimmed === "" ? null : Number(trimmed);
}

// Only values of the active custom fields are sent: the API rejects other keys, and it keeps
// the stored values of switched-off fields by itself.
function activeExtraFields(values, fields) {
  return Object.fromEntries(fields
    .filter((field) => Object.hasOwn(values, field.fieldKey))
    .map((field) => [field.fieldKey, values[field.fieldKey]]));
}

// Builds the POST/PUT body. companyId is sent only when a super admin creates an account.
// fields: the active ACCOUNT custom field definitions.
export function toBody(form, { includeCompany, fields = [] }) {
  const body = {};
  TEXT_KEYS.forEach((key) => {
    body[key] = form[key].trim();
  });
  body.latitude = toNumberOrNull(form.latitude);
  body.longitude = toNumberOrNull(form.longitude);
  body.extraFields = activeExtraFields(form.extraFields, fields);
  if (includeCompany && form.companyId) body.companyId = Number(form.companyId);
  return body;
}

export function formatLocation(account, keys = ["city", "state", "country"]) {
  return keys.map((key) => account[key]).filter(Boolean).join(", ");
}
