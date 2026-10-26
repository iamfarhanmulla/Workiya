// In-memory SQL Server source for the copy integration test, shaped like mssql driver output:
// PascalCase columns, JS Dates, bigint ids as strings. Activity 1 (company 2) is assigned to a
// company-1 user, so the copy must skip it, its submission 6 and their history versions.
const T0 = new Date("2026-04-06T10:19:20.494Z");
const T1 = new Date("2026-10-21T09:49:26.475Z");
const T2 = new Date("2026-10-23T04:49:21.384Z");
const STD = {
  CreatedAtUtc: T0, CreatedBy: null, UpdatedAtUtc: null, UpdatedBy: null, IsDeleted: false,
};

function person(id, companyId, roleId, managerId) {
  return {
    ...STD,
    Id: id,
    CompanyId: companyId,
    Username: `user${id}`,
    FirstName: "First",
    LastName: "Last",
    DisplayName: `User ${id}`,
    Email: `User${id}@Example.test`,
    PasswordHash: "hash",
    PasswordSalt: "salt",
    PasswordIterations: 10000,
    ManagerId: managerId,
    RoleId: roleId,
    Status: 1,
    FailedLoginCount: 0,
    IsActive: true,
  };
}

function activity(id, companyId, assignedTo) {
  return {
    ...STD,
    Id: id,
    CompanyId: companyId,
    ActivityTypeId: 2,
    AccountId: 1,
    AssignedTo: assignedTo,
    AssignedBy: 1,
    Title: `Visit ${id}`,
    Status: "Pending",
    Priority: "Medium",
    UpdatedAtUtc: T1,
    ValidFromUtc: T1,
  };
}

const SOURCE = Object.freeze({
  Genders: [{
    ...STD, Id: 1, Name: "Male", Code: "M", IsActive: true,
  }],
  Roles: [1, 2, 3, 4].map((id) => ({
    // Role 1 is SUPER_ADMIN: user 1 may assign activities in any company.
    ...STD,
    Id: id,
    Name: `Role ${id}`,
    Code: id === 1 ? "SUPER_ADMIN" : `ROLE_${id}`,
    IsActive: true,
  })),
  Companies: [1, 2].map((id) => ({
    Id: id,
    Name: `Company ${id}`,
    Key: `c${id}`,
    Status: 1,
    IsActive: true,
    IsDeleted: false,
    CreatedAtUtc: T0,
    UpdatedAtUtc: T1,
  })),
  Users: [person(1, 1, 1, null), person(19, 1, 3, 20), person(20, 1, 4, null),
    person(30, 2, 3, null)],
  CompanyTerminology: [{
    ...STD, Id: 1, CompanyId: 2, TermKey: "account.singular", Label: "Doctor",
  }],
  CustomFieldDefinitions: [{
    ...STD,
    Id: 3,
    CompanyId: 2,
    EntityType: "ACCOUNT",
    FieldKey: "tier",
    Label: "Tier",
    DataType: "SELECT",
    IsRequired: false,
    OptionsJson: "[\"A\",\"B\"]",
    SortOrder: 1,
    IsActive: true,
  }],
  ActivityTypes: [{
    ...STD,
    Id: 2,
    CompanyId: 2,
    Code: "VISIT",
    Name: "Visit",
    RequiresCheckIn: true,
    MinPhotos: 1,
    RequiresSignature: false,
    RequiresCustomerOtp: false,
    IsActive: true,
  }],
  Accounts: [{
    ...STD,
    Id: 1,
    CompanyId: 2,
    Name: "Dr. Mehta",
    Latitude: 19.0760123,
    ExtraFields: "{\"specialization\":\"Cardiologist\"}",
    IsActive: true,
    ValidFromUtc: T1,
  }],
  AccountAssignments: [{
    ...STD, Id: 4, CompanyId: 2, AccountId: 1, UserId: 30, VisitsPerMonth: 4, ValidFromUtc: T1,
  }],
  // Activity 1 is assigned to a user of company 1: rejected by the same-company rule.
  Activities: [activity(1, 2, 19), activity(2, 2, 30)],
  Submissions: [5, 6].map((id) => ({
    ...STD,
    Id: id,
    CompanyId: 2,
    ActivityId: id === 5 ? 2 : 1,
    SubmittedBy: 30,
    Rating: 4,
    Answers: "{\"met\":true}",
    ReviewStatus: "Pending",
    SubmittedAtUtc: T1,
    ValidFromUtc: T1,
  })),
  AuditLogs: [
    {
      Id: "7",
      EventType: "LOGIN",
      EntityType: "User",
      EntityId: "1",
      PerformedAtUtc: T1,
      OldValue: "not json",
      NewValue: "{\"rememberMe\":false}",
      CreatedAtUtc: T1,
    },
  ],
  // Versions of the skipped activity 1 and of its submission 6 are left out too.
  ActivitiesHistory: [
    { ...activity(1, 2, 19), ValidFromUtc: T0, ValidToUtc: T1 },
    { ...activity(2, 2, 30), ValidFromUtc: T1, ValidToUtc: T2 },
  ],
  SubmissionsHistory: [6, 5].map((id) => ({
    ...STD,
    Id: id,
    CompanyId: 2,
    ActivityId: id === 5 ? 2 : 1,
    SubmittedBy: 30,
    ReviewStatus: "Pending",
    SubmittedAtUtc: T0,
    ValidFromUtc: T0,
    ValidToUtc: T1,
  })),
});

const fakeSource = async () => ({
  readRows: async (spec) => SOURCE[spec.source] || [],
  close: async () => undefined,
});

module.exports = {
  T0, T1, T2, fakeSource,
};
