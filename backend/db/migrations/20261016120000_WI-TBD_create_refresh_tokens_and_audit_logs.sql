-- Migration: 20261016120000_WI-TBD_create_refresh_tokens_and_audit_logs
-- Purpose : Cookie-based JWT auth. Stores hashed refresh tokens (rotation + reuse
--           detection) and an append-only audit log. Adds SchemaMigrations tracking and
--           the login-lockout columns the auth code reads on dbo.Users.
-- Apply   : npm run db:sql --workspace backend -- db/migrations/<this file> up --yes
-- Revert  : npm run db:sql --workspace backend -- db/migrations/<this file> down --yes
-- Every statement is idempotent, so re-running a section is safe.
-- dbo.Users is shared with another system: agree the new Users columns with its owners
-- before applying. Columns that already exist are left untouched.

-- ==== UP ====

IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SchemaMigrations (
    Id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SchemaMigrations PRIMARY KEY,
    FileName     NVARCHAR(255)     NOT NULL CONSTRAINT UQ_SchemaMigrations_FileName UNIQUE,
    AppliedAtUtc DATETIME2(3)      NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAtUtc DEFAULT GETUTCDATE()
  );
END
GO

-- Columns this migration adds to dbo.Users are tagged with the WorkiyaMigration extended
-- property, so DOWN removes only what UP created and never a column the other system owns.
IF COL_LENGTH('dbo.Users', 'FailedLoginCount') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD FailedLoginCount INT NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT 0;
  EXEC sys.sp_addextendedproperty @name = N'WorkiyaMigration', @value = N'20261016120000',
    @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'Users',
    @level2type = N'COLUMN', @level2name = N'FailedLoginCount';
END
GO

IF COL_LENGTH('dbo.Users', 'LockoutEndUtc') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD LockoutEndUtc DATETIMEOFFSET NULL;
  EXEC sys.sp_addextendedproperty @name = N'WorkiyaMigration', @value = N'20261016120000',
    @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'Users',
    @level2type = N'COLUMN', @level2name = N'LockoutEndUtc';
END
GO

IF COL_LENGTH('dbo.Users', 'LastFailedLoginUtc') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD LastFailedLoginUtc DATETIMEOFFSET NULL;
  EXEC sys.sp_addextendedproperty @name = N'WorkiyaMigration', @value = N'20261016120000',
    @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'Users',
    @level2type = N'COLUMN', @level2name = N'LastFailedLoginUtc';
END
GO

IF COL_LENGTH('dbo.Users', 'LastLoginUtc') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD LastLoginUtc DATETIMEOFFSET NULL;
  EXEC sys.sp_addextendedproperty @name = N'WorkiyaMigration', @value = N'20261016120000',
    @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'Users',
    @level2type = N'COLUMN', @level2name = N'LastLoginUtc';
END
GO

IF COL_LENGTH('dbo.Users', 'UpdatedBy') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD UpdatedBy INT NULL;
  EXEC sys.sp_addextendedproperty @name = N'WorkiyaMigration', @value = N'20261016120000',
    @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'Users',
    @level2type = N'COLUMN', @level2name = N'UpdatedBy';
END
GO

-- CompanyId is NULL for users outside any company (SUPER_ADMIN).
IF OBJECT_ID('dbo.RefreshTokens', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.RefreshTokens (
    Id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RefreshTokens PRIMARY KEY,
    UserId              INT              NOT NULL,
    CompanyId           INT              NULL,
    TokenHash           CHAR(64)         NOT NULL,
    FamilyId            UNIQUEIDENTIFIER NOT NULL,
    IsPersistent        BIT              NOT NULL CONSTRAINT DF_RefreshTokens_IsPersistent DEFAULT 0,
    ExpiresAtUtc        DATETIME2(3)     NOT NULL,
    RevokedAtUtc        DATETIME2(3)     NULL,
    RevokedReason       NVARCHAR(50)     NULL,
    ReplacedByTokenHash CHAR(64)         NULL,
    CreatedByIp         NVARCHAR(45)     NULL,
    UserAgent           NVARCHAR(500)    NULL,
    CreatedAtUtc        DATETIME2(3)     NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy           INT              NULL,
    UpdatedAtUtc        DATETIME2(3)     NOT NULL CONSTRAINT DF_RefreshTokens_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy           INT              NULL,
    IsDeleted           BIT              NOT NULL CONSTRAINT DF_RefreshTokens_IsDeleted DEFAULT 0,
    CONSTRAINT UQ_RefreshTokens_TokenHash UNIQUE (TokenHash),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
  );
END
GO

-- Repairs a RefreshTokens table created by an earlier draft of this migration.
IF COLUMNPROPERTY(OBJECT_ID('dbo.RefreshTokens'), 'CompanyId', 'AllowsNull') = 0
  ALTER TABLE dbo.RefreshTokens ALTER COLUMN CompanyId INT NULL;
GO

IF OBJECT_ID('dbo.FK_RefreshTokens_Companies', 'F') IS NULL
  ALTER TABLE dbo.RefreshTokens
    ADD CONSTRAINT FK_RefreshTokens_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RefreshTokens_FamilyId' AND object_id = OBJECT_ID('dbo.RefreshTokens'))
  CREATE INDEX IX_RefreshTokens_FamilyId ON dbo.RefreshTokens (FamilyId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RefreshTokens_UserId' AND object_id = OBJECT_ID('dbo.RefreshTokens'))
  CREATE INDEX IX_RefreshTokens_UserId ON dbo.RefreshTokens (UserId);
GO

-- AuditLogs is append-only evidence. It intentionally has no UpdatedAtUtc, UpdatedBy
-- or IsDeleted columns: rows are never edited or soft-deleted, and the trigger below
-- rejects every UPDATE and DELETE so the history cannot be altered after the fact.
-- The trigger does not stop TRUNCATE TABLE or a principal with ALTER on the table
-- (who can disable it). The DBA must also DENY UPDATE, DELETE and ALTER on dbo.AuditLogs
-- to the application login, which must not be db_owner or db_ddladmin.
IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLogs (
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
    EventType      NVARCHAR(100) NOT NULL,
    EntityType     NVARCHAR(100) NOT NULL,
    EntityId       NVARCHAR(100) NULL,
    CompanyId      INT           NULL,
    PerformedBy    INT           NULL,
    PerformedAtUtc DATETIME2(3)  NOT NULL CONSTRAINT DF_AuditLogs_PerformedAtUtc DEFAULT GETUTCDATE(),
    OldValue       NVARCHAR(MAX) NULL,
    NewValue       NVARCHAR(MAX) NULL,
    IpAddress      NVARCHAR(45)  NULL,
    UserAgent      NVARCHAR(500) NULL,
    CreatedAtUtc   DATETIME2(3)  NOT NULL CONSTRAINT DF_AuditLogs_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy      INT           NULL
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Entity' AND object_id = OBJECT_ID('dbo.AuditLogs'))
  CREATE INDEX IX_AuditLogs_Entity ON dbo.AuditLogs (EntityType, EntityId, PerformedAtUtc);
GO

CREATE OR ALTER TRIGGER dbo.trg_AuditLogs_Immutable
ON dbo.AuditLogs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  THROW 51000, 'AuditLogs is append-only. UPDATE and DELETE are not allowed.', 1;
END
GO

-- ==== DOWN ====

-- WARNING: dropping AuditLogs destroys audit history. Export it before reverting.
IF OBJECT_ID('dbo.trg_AuditLogs_Immutable', 'TR') IS NOT NULL
  DROP TRIGGER dbo.trg_AuditLogs_Immutable;
GO

IF OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL
  DROP TABLE dbo.AuditLogs;
GO

IF OBJECT_ID('dbo.RefreshTokens', 'U') IS NOT NULL
  DROP TABLE dbo.RefreshTokens;
GO

-- Drops only the Users columns that UP added (tagged WorkiyaMigration = 20261016120000).
DECLARE @column SYSNAME;
DECLARE @statement NVARCHAR(400);
DECLARE added_columns CURSOR LOCAL STATIC FOR
  SELECT c.name
  FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.class = 1
    AND ep.major_id = OBJECT_ID('dbo.Users')
    AND ep.name = N'WorkiyaMigration'
    AND CAST(ep.value AS NVARCHAR(50)) = N'20261016120000';
OPEN added_columns;
FETCH NEXT FROM added_columns INTO @column;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF @column = N'FailedLoginCount' AND OBJECT_ID('dbo.DF_Users_FailedLoginCount', 'D') IS NOT NULL
    ALTER TABLE dbo.Users DROP CONSTRAINT DF_Users_FailedLoginCount;
  SET @statement = N'ALTER TABLE dbo.Users DROP COLUMN ' + QUOTENAME(@column) + N';';
  EXEC sys.sp_executesql @statement;
  FETCH NEXT FROM added_columns INTO @column;
END
CLOSE added_columns;
DEALLOCATE added_columns;
GO
