// Public user shape for the auth endpoints, built from a users row (snake_case columns).
function toUserDto(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    roleId: row.role_id,
    roleCode: row.role_code || null,
    roleName: row.role_name || null,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
    status: row.status,
  };
}

module.exports = { toUserDto };
