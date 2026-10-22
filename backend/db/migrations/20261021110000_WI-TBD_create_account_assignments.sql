-- Migration: 20261021110000_WI-TBD_create_account_assignments
-- Purpose : Which rep covers which account, and how often it should be visited.
--           Basis for the rep's "my accounts" list, planned-vs-completed and
--           missed-visit reports, and handing accounts over when a rep leaves.
--           An account can be covered by several reps (e.g. different divisions).
-- Requires: 20261021100000_WI-TBD_create_generic_accounts_activities.sql applied first.
-- Apply   : cd backend && node scripts/run-sql-migration.js db/migrations/<this file> up --yes
--           In SSMS: pressing F5 on the whole file runs only UP (see the guard below).
-- Revert  : cd backend && node scripts/run-sql-migration.js db/migrations/<this file> down --yes
--           In SSMS: select the DOWN section only, then F5.
-- History : System-versioned temporal table, so every hand-over is kept in
--           AccountAssignmentsHistory (who covered which account, and when).
-- Data    : No rows are created. Assignments are made in the app; the only existing
--           activity links a company-1 user to a company-2 account and is not a valid
--           source.

-- ==== UP ====

IF OBJECT_ID('dbo.AccountAssignments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AccountAssignments (
    Id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccountAssignments PRIMARY KEY,
    CompanyId      INT          NOT NULL,
    AccountId      INT          NOT NULL,
    UserId         INT          NOT NULL,
    VisitsPerMonth TINYINT      NULL,
    CreatedAtUtc   DATETIME2(3) NOT NULL CONSTRAINT DF_AccountAssignments_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy      INT          NULL,
    UpdatedAtUtc   DATETIME2(3) NOT NULL CONSTRAINT DF_AccountAssignments_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy      INT          NULL,
    IsDeleted      BIT          NOT NULL CONSTRAINT DF_AccountAssignments_IsDeleted DEFAULT 0,
    ValidFromUtc   DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidToUtc     DATETIME2(3) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc),
    CONSTRAINT FK_AccountAssignments_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT FK_AccountAssignments_Accounts FOREIGN KEY (CompanyId, AccountId)
      REFERENCES dbo.Accounts (CompanyId, Id),
    CONSTRAINT FK_AccountAssignments_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_AccountAssignments_VisitsPerMonth
      CHECK (VisitsPerMonth IS NULL OR VisitsPerMonth BETWEEN 1 AND 31)
  )
  WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.AccountAssignmentsHistory));
  -- One active assignment per rep and account; a removed (soft-deleted) one can be re-added.
  CREATE UNIQUE INDEX UX_AccountAssignments_Account_User
    ON dbo.AccountAssignments (AccountId, UserId) WHERE IsDeleted = 0;
  -- "My accounts" for a rep.
  CREATE INDEX IX_AccountAssignments_Company_User
    ON dbo.AccountAssignments (CompanyId, UserId) WHERE IsDeleted = 0;
END
GO

-- SSMS guard: when the whole file is run with F5 in SSMS, stop here so the DOWN section
-- below is compiled but not executed. The last line of the file switches execution back on.
IF APP_NAME() LIKE N'Microsoft SQL Server Management Studio%'
  SET NOEXEC ON;
GO

-- ==== DOWN ====

-- WARNING: dropping this table deletes all assignments and their history.
IF OBJECT_ID('dbo.AccountAssignments', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.AccountAssignments SET (SYSTEM_VERSIONING = OFF);
  DROP TABLE dbo.AccountAssignments;
  DROP TABLE IF EXISTS dbo.AccountAssignmentsHistory;
END
GO

SET NOEXEC OFF;
GO
