function toUserDto(row) {
  return {
    id: row.Id,
    companyId: row.CompanyId,
    roleId: row.RoleId,
    roleCode: row.RoleCode || null,
    roleName: row.RoleName || null,
    username: row.Username,
    email: row.Email,
    displayName: row.DisplayName,
    firstName: row.FirstName,
    middleName: row.MiddleName,
    lastName: row.LastName,
    phoneNumber: row.PhoneNumber,
    status: row.Status,
  };
}

module.exports = { toUserDto };
