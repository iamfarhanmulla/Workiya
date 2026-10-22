# Workiya database: entity relationship diagram

Database `dbTest_VSE` (SQL Server 2017), shared with another system. This diagram covers the
tables Workiya uses. Other tables in the same database (`Tenants`, `UserRoles`, `UserConfigs`,
`UserType`, `Genders`, `SniffTest`, `SniffJoin`) belong to that system and are not shown.

| Group | Tables | Status |
|---|---|---|
| Identity and tenancy | Companies, Roles, Users | Existing |
| Auth and audit | RefreshTokens, AuditLogs, SchemaMigrations | Existing (migration 20261016120000) |
| Company settings | CompanyTerminology, CustomFieldDefinitions, ActivityTypes | **New** (migration 20261021100000) |
| Field work | Accounts, AccountAssignments, Activities, Submissions | **New**, with temporal history tables (AccountAssignments: migration 20261021110000) |
| Old pharma tables | Doctors, Tasks, TaskFeedback | Backup only; the code stops using them |

Only key columns are drawn. `erd.html` in this folder lists every column.

```mermaid
erDiagram
  Companies ||--o{ Users : "employs (CompanyId)"
  Roles ||--o{ Users : "role (RoleId)"
  Users |o--o{ Users : "manages (ManagerId)"
  Users ||--o{ RefreshTokens : "sessions"
  Companies |o--o{ RefreshTokens : "company"
  Users |o..o{ AuditLogs : "performed by (no FK)"

  Companies ||--o{ CompanyTerminology : "labels"
  Companies ||--o{ CustomFieldDefinitions : "extra fields"
  Companies ||--o{ ActivityTypes : "visit rules"
  Companies ||--o{ Accounts : "owns"
  Accounts ||--o{ AccountAssignments : "covered by"
  Users ||--o{ AccountAssignments : "covers"
  Accounts ||--o{ Activities : "visited in"
  ActivityTypes ||--o{ Activities : "type of"
  Users ||--o{ Activities : "assigned to / by"
  Activities ||--o{ Submissions : "proof"
  Users ||--o{ Submissions : "submitted / reviewed by"

  Companies |o--o{ Doctors : "old"
  Doctors ||--o{ Tasks : "old"
  Tasks ||--o{ TaskFeedback : "old"
  Accounts |o..o| Doctors : "LegacyDoctorId (copy link)"
  Activities |o..o| Tasks : "LegacyTaskId (copy link)"
  Submissions |o..o| TaskFeedback : "LegacyTaskFeedbackId"

  Companies {
    int Id PK
    nvarchar Name
    nvarchar Key UK
    nvarchar Plan
    bit IsActive
  }
  Roles {
    int Id PK
    nvarchar Name
    nvarchar Code UK "SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE"
  }
  Users {
    int Id PK
    int CompanyId FK
    int RoleId FK
    int ManagerId FK
    nvarchar Email
    nvarchar PasswordHash "PBKDF2 or Argon2id"
    int FailedLoginCount
    datetimeoffset LockoutEndUtc
  }
  RefreshTokens {
    bigint Id PK
    int UserId FK
    int CompanyId FK
    char TokenHash UK "SHA-256 of the token"
    uniqueidentifier FamilyId
    datetime2 ExpiresAtUtc
    datetime2 RevokedAtUtc
  }
  AuditLogs {
    bigint Id PK
    nvarchar EventType
    nvarchar EntityType
    nvarchar EntityId
    int PerformedBy
    datetime2 PerformedAtUtc
  }
  CompanyTerminology {
    int Id PK
    int CompanyId FK
    nvarchar TermKey "account.singular, activity.plural ..."
    nvarchar Label "Doctor, Shop, Visit ..."
  }
  CustomFieldDefinitions {
    int Id PK
    int CompanyId FK
    nvarchar EntityType "ACCOUNT or SUBMISSION"
    nvarchar FieldKey "specialization"
    nvarchar Label "Specialization"
    nvarchar DataType "TEXT, NUMBER, SELECT ..."
    bit IsRequired
  }
  ActivityTypes {
    int Id PK
    int CompanyId FK
    nvarchar Code "DOCTOR_VISIT"
    int GeofenceMeters
    tinyint MinPhotos
    bit RequiresSignature
    bit RequiresCustomerOtp
  }
  Accounts {
    int Id PK
    int CompanyId FK
    nvarchar Name
    nvarchar Address
    decimal Latitude
    decimal Longitude
    nvarchar ExtraFields "JSON, company's own fields"
    int LegacyDoctorId
  }
  AccountAssignments {
    int Id PK
    int CompanyId FK
    int AccountId FK
    int UserId FK "the rep"
    tinyint VisitsPerMonth "planned visits"
  }
  Activities {
    int Id PK
    int CompanyId FK
    int ActivityTypeId FK
    int AccountId FK
    int AssignedTo FK
    int AssignedBy FK
    nvarchar Status "Pending ... Missed"
    datetime2 DueAtUtc
    int LegacyTaskId
  }
  Submissions {
    int Id PK
    int CompanyId FK
    int ActivityId FK
    int SubmittedBy FK
    datetime2 CheckInAtUtc
    decimal CheckInLatitude
    nvarchar PhotoUrl
    datetime2 CustomerOtpVerifiedAtUtc
    nvarchar Answers "JSON, company's own questions"
    nvarchar ReviewStatus "Pending, Approved, Rejected"
  }
  Doctors {
    int Id PK
    int CompanyId FK
    nvarchar Name
    nvarchar Specialization
    nvarchar HospitalName
  }
  Tasks {
    int Id PK
    int DoctorId FK
    int AssignedTo FK
    nvarchar Status
  }
  TaskFeedback {
    int Id PK
    int TaskId FK
    bit DoctorMet
    nvarchar FeedbackText
  }
```

## Rules the design enforces

- **Company isolation in the database itself.** Activities point at Accounts and ActivityTypes
  through `(CompanyId, Id)`, and Submissions point at Activities the same way. A row can never
  reference another company's data, even if the API has a bug.
- **Change history.** Accounts, Activities and Submissions are SQL Server temporal tables.
  Every update and delete is kept automatically in `AccountsHistory`, `ActivitiesHistory` and
  `SubmissionsHistory`.
- **Who covers which account.** AccountAssignments links reps to accounts (several reps per
  account are allowed) with a planned visit frequency, so missed visits can be detected.
- **Soft delete.** Every new table has `IsDeleted`; rows are never physically deleted by the app.
- **Company-specific data is JSON with a definition.** `Accounts.ExtraFields` and
  `Submissions.Answers` must be valid JSON (CHECK constraint), and each key is described in
  `CustomFieldDefinitions`.
- **Old tables stay untouched.** The copy keeps `Legacy*Id` links so every new row can be
  traced back to the Doctors / Tasks / TaskFeedback row it came from.
