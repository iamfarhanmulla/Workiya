# Workiya database: entity relationship diagram

PostgreSQL 18 with PostGIS (Neon), owned by Workiya alone. The schema is created by the
migrations in `backend/db/postgres/`. The old SQL Server design (the shared `dbTest_VSE`
database) is kept for history in `backend/db/sqlserver-archive/`, and
`docs/database/postgres-migration-plan.md` records the move.

| Group | Tables |
|---|---|
| Reference data | genders, roles |
| Identity and tenancy | companies, users |
| Auth and audit | refresh_tokens, audit_logs (append-only), schema_migrations |
| Company settings | company_terminology, custom_field_definitions, activity_types |
| Field work | accounts, account_assignments, activities, submissions, each with a `<table>_history` table |

Naming: tables are plural snake_case, columns snake_case, and times are `timestamptz` (UTC)
named `*_at`. Every table has `created_at`, `updated_at`, `created_by`, `updated_by` and
`is_deleted` (soft delete); `audit_logs` has only `created_at` and `created_by`.

Only key columns are drawn. `erd.html` in this folder still shows the SQL Server design.

```mermaid
erDiagram
  companies ||--o{ users : "employs (company_id)"
  roles |o--o{ users : "role (role_id)"
  genders |o--o{ users : "gender (gender_id)"
  users |o--o{ users : "manages (manager_id)"
  users ||--o{ refresh_tokens : "sessions"
  companies |o--o{ refresh_tokens : "company"
  users |o..o{ audit_logs : "performed by (no FK)"

  companies ||--o{ company_terminology : "labels"
  companies ||--o{ custom_field_definitions : "extra fields"
  companies ||--o{ activity_types : "visit rules"
  companies ||--o{ accounts : "owns"
  accounts ||--o{ account_assignments : "covered by"
  users ||--o{ account_assignments : "covers (same company)"
  accounts ||--o{ activities : "visited in"
  activity_types ||--o{ activities : "type of"
  users ||--o{ activities : "assigned to (same company) / by"
  activities ||--o{ submissions : "proof"
  users ||--o{ submissions : "submitted (same company) / reviewed by"

  accounts ||..o{ accounts_history : "old versions"
  account_assignments ||..o{ account_assignments_history : "old versions"
  activities ||..o{ activities_history : "old versions"
  submissions ||..o{ submissions_history : "old versions"

  companies {
    integer id PK
    varchar name
    varchar key UK
    varchar plan
    boolean is_active
  }
  roles {
    integer id PK
    varchar name
    varchar code UK "SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE"
  }
  genders {
    integer id PK
    varchar code UK
  }
  users {
    integer id PK
    integer company_id FK
    integer role_id FK
    integer manager_id FK
    citext email "unique per company among active rows"
    varchar password_hash "PBKDF2 or Argon2id"
    integer failed_login_count
    timestamptz lockout_end_at
  }
  refresh_tokens {
    bigint id PK
    integer user_id FK
    integer company_id FK
    char token_hash UK "SHA-256 of the token"
    uuid family_id
    timestamptz expires_at
    timestamptz revoked_at
  }
  audit_logs {
    bigint id PK
    varchar event_type
    varchar entity_type
    varchar entity_id
    integer performed_by
    timestamptz performed_at
    jsonb old_value
    jsonb new_value
  }
  company_terminology {
    integer id PK
    integer company_id FK
    varchar term_key "account.singular, activity.plural ..."
    varchar label "Doctor, Shop, Visit ..."
  }
  custom_field_definitions {
    integer id PK
    integer company_id FK
    varchar entity_type "ACCOUNT or SUBMISSION"
    varchar field_key "specialization"
    varchar data_type "TEXT, NUMBER, SELECT ..."
    boolean is_required
    jsonb options_json "SELECT options"
  }
  activity_types {
    integer id PK
    integer company_id FK
    varchar code "DOCTOR_VISIT"
    integer geofence_meters
    smallint min_photos
    boolean requires_signature
    boolean requires_customer_otp
  }
  accounts {
    integer id PK
    integer company_id FK
    varchar name "trigram index"
    numeric latitude
    numeric longitude
    jsonb extra_fields "object, company's own fields"
    timestamptz valid_from
  }
  account_assignments {
    integer id PK
    integer company_id FK
    integer account_id FK
    integer user_id FK "the rep"
    smallint visits_per_month "planned visits"
    timestamptz valid_from
  }
  activities {
    integer id PK
    integer company_id FK
    integer activity_type_id FK
    integer account_id FK
    integer assigned_to FK
    integer assigned_by FK
    varchar status "Pending ... Missed"
    timestamptz due_at
    timestamptz valid_from
  }
  submissions {
    integer id PK
    integer company_id FK
    integer activity_id FK
    integer submitted_by FK
    timestamptz check_in_at
    numeric check_in_latitude
    timestamptz customer_otp_verified_at
    jsonb answers "company's own questions"
    varchar review_status "Pending, Approved, Rejected"
    timestamptz valid_from
  }
```

## Rules the design enforces

- **Company isolation in the database itself.** `users` is unique on `(company_id, id)`.
  activities point at accounts, activity_types and the assigned user through
  `(company_id, ...)` foreign keys; submissions point at activities and the submitting user,
  and account_assignments at accounts and the rep, in the same way. A row can never reference
  another company's data, even if the API has a bug. `assigned_by` and `reviewed_by` may be
  any user (for example a super admin).
- **Change history.** accounts, account_assignments, activities and submissions have a
  `valid_from` column. On every UPDATE or DELETE the trigger function `record_history()` copies
  the old row, with `valid_to = now()`, into `<table>_history` (no keys, no foreign keys).
- **Audit log is append-only.** Triggers on `audit_logs` reject UPDATE, DELETE and TRUNCATE;
  the migration also documents the REVOKE for the app role.
- **Who covers which account.** account_assignments links reps to accounts (several reps per
  account are allowed) with a planned visit frequency, so missed visits can be detected.
- **Soft delete.** Rows are never physically deleted by the app. Unique keys such as user email
  and username or custom field keys are partial unique indexes `WHERE NOT is_deleted`.
- **Company-specific data is JSON with a definition.** `accounts.extra_fields` (a JSON object)
  and `submissions.answers` are `jsonb`, and each key is described in
  `custom_field_definitions`.
- **Old pharma tables are not moved.** Doctors, Tasks, TaskFeedback and the `Legacy*Id`
  columns stay in SQL Server; `backend/scripts/copy-sqlserver-to-postgres.js` copies
  everything else once.
