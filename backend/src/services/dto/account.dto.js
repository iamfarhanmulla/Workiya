function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toNullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

// ExtraFields is stored as JSON text; anything that is not a JSON object reads as {}.
function parseExtraFields(text) {
  if (!text) {
    return {};
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function toAssignedUserDto(row) {
  return {
    userId: row.UserId,
    displayName: row.DisplayName,
    visitsPerMonth: toNullableNumber(row.VisitsPerMonth),
  };
}

function toAssignmentDto(row) {
  return { ...toAssignedUserDto(row), roleCode: row.RoleCode || null };
}

function toAccountDto(row, assignmentRows = []) {
  return {
    id: row.Id,
    companyId: row.CompanyId,
    name: row.Name,
    phoneNumber: row.PhoneNumber ?? null,
    email: row.Email ?? null,
    address: row.Address ?? null,
    city: row.City ?? null,
    state: row.State ?? null,
    country: row.Country ?? null,
    latitude: toNullableNumber(row.Latitude),
    longitude: toNullableNumber(row.Longitude),
    photoUrl: row.PhotoUrl ?? null,
    notes: row.Notes ?? null,
    extraFields: parseExtraFields(row.ExtraFields),
    isActive: Boolean(row.IsActive),
    createdAtUtc: toIso(row.CreatedAtUtc),
    updatedAtUtc: toIso(row.UpdatedAtUtc),
    assignedUsers: assignmentRows.map(toAssignedUserDto),
  };
}

module.exports = { toAccountDto, toAssignmentDto, parseExtraFields };
