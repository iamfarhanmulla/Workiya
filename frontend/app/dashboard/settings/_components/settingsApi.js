import { api } from "@/lib/apiClient";

export const TERM_KEYS = [
  "account.singular",
  "account.plural",
  "activity.singular",
  "activity.plural",
  "submission.singular",
  "submission.plural",
];

export const DATA_TYPES = [
  "TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL",
];

export const OPTION_TYPES = ["SELECT", "MULTI_SELECT"];

// SUPER_ADMIN works on a chosen company: every settings call carries ?companyId.
function config(companyId) {
  return { params: companyId ? { companyId } : {} };
}

function withCompany(body, companyId) {
  return companyId ? { ...body, companyId } : body;
}

function unwrap(res) {
  return res.data.data;
}

export async function getTerminology(companyId) {
  return unwrap(await api.get("/settings/terminology", config(companyId)));
}

export async function saveTerminology(labels, companyId) {
  return unwrap(await api.put("/settings/terminology", { labels }, config(companyId)));
}

export async function listCustomFields(entityType, companyId) {
  const cfg = config(companyId);
  cfg.params = { ...cfg.params, entityType, includeInactive: true };
  return unwrap(await api.get("/settings/custom-fields", cfg));
}

export async function saveCustomField(id, body, companyId) {
  const res = id
    ? await api.put(`/settings/custom-fields/${id}`, body, config(companyId))
    : await api.post("/settings/custom-fields", withCompany(body, companyId), config(companyId));
  return unwrap(res);
}

export async function deleteCustomField(id, companyId) {
  return unwrap(await api.delete(`/settings/custom-fields/${id}`, config(companyId)));
}

export async function listActivityTypes(companyId) {
  const cfg = config(companyId);
  cfg.params = { ...cfg.params, includeInactive: true };
  return unwrap(await api.get("/settings/activity-types", cfg));
}

export async function saveActivityType(id, body, companyId) {
  const res = id
    ? await api.put(`/settings/activity-types/${id}`, body, config(companyId))
    : await api.post("/settings/activity-types", withCompany(body, companyId), config(companyId));
  return unwrap(res);
}

export async function deleteActivityType(id, companyId) {
  return unwrap(await api.delete(`/settings/activity-types/${id}`, config(companyId)));
}

function words(text) {
  return String(text || "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// "Hospital name (main)" -> "hospitalNameMain"; a leading digit is dropped.
export function toCamelKey(label) {
  const camel = words(label)
    .map((w, i) => (i === 0
      ? w.toLowerCase()
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  return camel.replace(/^[0-9]+/, "").slice(0, 50);
}

// "Doctor visit" -> "DOCTOR_VISIT"
export function toUpperSnake(name) {
  return words(name).join("_").toUpperCase().replace(/^[0-9_]+/, "")
    .slice(0, 50);
}

// "A, B ,, a" -> ["A", "B", "a"] (empty and repeated entries removed).
export function parseOptions(text) {
  const items = String(text || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...new Set(items)];
}
