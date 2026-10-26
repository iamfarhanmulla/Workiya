function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toNullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

// extra_fields is jsonb (pg returns it parsed); anything that is not an object reads as {}.
function toExtraFields(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toAssignedUserDto(row) {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    visitsPerMonth: toNullableNumber(row.visits_per_month),
  };
}

function toAssignmentDto(row) {
  return { ...toAssignedUserDto(row), roleCode: row.role_code || null };
}

// The API keeps its createdAtUtc / updatedAtUtc names; the columns are created_at / updated_at.
function toAccountDto(row, assignmentRows = []) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    phoneNumber: row.phone_number ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    country: row.country ?? null,
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
    photoUrl: row.photo_url ?? null,
    notes: row.notes ?? null,
    extraFields: toExtraFields(row.extra_fields),
    isActive: Boolean(row.is_active),
    createdAtUtc: toIso(row.created_at),
    updatedAtUtc: toIso(row.updated_at),
    assignedUsers: assignmentRows.map(toAssignedUserDto),
  };
}

module.exports = { toAccountDto, toAssignmentDto, toExtraFields };
