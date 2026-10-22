-- Migration: 20261021100000_WI-TBD_create_generic_accounts_activities
-- Purpose : Industry-neutral data model. Accounts (who/where we visit), Activities (work
--           assigned to a rep), Submissions (visit proof + answers), plus per-company
--           configuration: CompanyTerminology (labels), CustomFieldDefinitions (extra
--           fields) and ActivityTypes (check-in / proof rules per kind of visit).
--           Doctors, Tasks and TaskFeedback are NOT changed; they stay as a backup.
-- Apply   : cd backend && node scripts/run-sql-migration.js db/migrations/<this file> up --yes
--           In SSMS: pressing F5 on the whole file runs only UP (see the guard below).
-- Revert  : cd backend && node scripts/run-sql-migration.js db/migrations/<this file> down --yes
--           In SSMS: select the DOWN section only, then F5.
-- History : Accounts, Activities and Submissions are system-versioned temporal tables
--           (hidden ValidFromUtc/ValidToUtc columns + *History tables) so every change
--           is kept automatically.
-- Tenancy : Every table carries CompanyId. Child rows reference parents through
--           (CompanyId, Id) composite keys, so a row can never point at another
--           company's data.

-- ==== UP ====

IF OBJECT_ID('dbo.CompanyTerminology', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CompanyTerminology (
    Id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CompanyTerminology PRIMARY KEY,
    CompanyId    INT           NOT NULL,
    TermKey      NVARCHAR(50)  NOT NULL,
    Label        NVARCHAR(100) NOT NULL,
    CreatedAtUtc DATETIME2(3)  NOT NULL CONSTRAINT DF_CompanyTerminology_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy    INT           NULL,
    UpdatedAtUtc DATETIME2(3)  NOT NULL CONSTRAINT DF_CompanyTerminology_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy    INT           NULL,
    IsDeleted    BIT           NOT NULL CONSTRAINT DF_CompanyTerminology_IsDeleted DEFAULT 0,
    CONSTRAINT FK_CompanyTerminology_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT CK_CompanyTerminology_TermKey CHECK (TermKey IN (
      N'account.singular', N'account.plural',
      N'activity.singular', N'activity.plural',
      N'submission.singular', N'submission.plural'))
  );
  CREATE UNIQUE INDEX UX_CompanyTerminology_Company_Term
    ON dbo.CompanyTerminology (CompanyId, TermKey) WHERE IsDeleted = 0;
END
GO

IF OBJECT_ID('dbo.CustomFieldDefinitions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomFieldDefinitions (
    Id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CustomFieldDefinitions PRIMARY KEY,
    CompanyId    INT           NOT NULL,
    EntityType   NVARCHAR(30)  NOT NULL,
    FieldKey     NVARCHAR(50)  NOT NULL,
    Label        NVARCHAR(100) NOT NULL,
    DataType     NVARCHAR(20)  NOT NULL,
    IsRequired   BIT           NOT NULL CONSTRAINT DF_CustomFieldDefinitions_IsRequired DEFAULT 0,
    OptionsJson  NVARCHAR(MAX) NULL,
    SortOrder    INT           NOT NULL CONSTRAINT DF_CustomFieldDefinitions_SortOrder DEFAULT 0,
    IsActive     BIT           NOT NULL CONSTRAINT DF_CustomFieldDefinitions_IsActive DEFAULT 1,
    CreatedAtUtc DATETIME2(3)  NOT NULL CONSTRAINT DF_CustomFieldDefinitions_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy    INT           NULL,
    UpdatedAtUtc DATETIME2(3)  NOT NULL CONSTRAINT DF_CustomFieldDefinitions_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy    INT           NULL,
    IsDeleted    BIT           NOT NULL CONSTRAINT DF_CustomFieldDefinitions_IsDeleted DEFAULT 0,
    CONSTRAINT FK_CustomFieldDefinitions_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT CK_CustomFieldDefinitions_EntityType CHECK (EntityType IN (N'ACCOUNT', N'SUBMISSION')),
    CONSTRAINT CK_CustomFieldDefinitions_DataType CHECK (DataType IN (
      N'TEXT', N'NUMBER', N'DATE', N'BOOLEAN', N'SELECT', N'MULTI_SELECT', N'PHONE', N'EMAIL')),
    CONSTRAINT CK_CustomFieldDefinitions_FieldKey CHECK (FieldKey NOT LIKE N'%[^a-zA-Z0-9_]%'),
    CONSTRAINT CK_CustomFieldDefinitions_OptionsJson CHECK (OptionsJson IS NULL OR ISJSON(OptionsJson) = 1)
  );
  CREATE UNIQUE INDEX UX_CustomFieldDefinitions_Company_Entity_Key
    ON dbo.CustomFieldDefinitions (CompanyId, EntityType, FieldKey) WHERE IsDeleted = 0;
END
GO

IF OBJECT_ID('dbo.ActivityTypes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ActivityTypes (
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivityTypes PRIMARY KEY,
    CompanyId           INT           NOT NULL,
    Code                NVARCHAR(50)  NOT NULL,
    Name                NVARCHAR(100) NOT NULL,
    RequiresCheckIn     BIT           NOT NULL CONSTRAINT DF_ActivityTypes_RequiresCheckIn DEFAULT 1,
    GeofenceMeters      INT           NULL,
    MinPhotos           TINYINT       NOT NULL CONSTRAINT DF_ActivityTypes_MinPhotos DEFAULT 0,
    RequiresSignature   BIT           NOT NULL CONSTRAINT DF_ActivityTypes_RequiresSignature DEFAULT 0,
    RequiresCustomerOtp BIT           NOT NULL CONSTRAINT DF_ActivityTypes_RequiresCustomerOtp DEFAULT 0,
    IsActive            BIT           NOT NULL CONSTRAINT DF_ActivityTypes_IsActive DEFAULT 1,
    CreatedAtUtc        DATETIME2(3)  NOT NULL CONSTRAINT DF_ActivityTypes_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy           INT           NULL,
    UpdatedAtUtc        DATETIME2(3)  NOT NULL CONSTRAINT DF_ActivityTypes_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy           INT           NULL,
    IsDeleted           BIT           NOT NULL CONSTRAINT DF_ActivityTypes_IsDeleted DEFAULT 0,
    CONSTRAINT FK_ActivityTypes_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT UQ_ActivityTypes_Company_Id UNIQUE (CompanyId, Id),
    CONSTRAINT CK_ActivityTypes_GeofenceMeters CHECK (GeofenceMeters IS NULL OR GeofenceMeters BETWEEN 10 AND 5000)
  );
  CREATE UNIQUE INDEX UX_ActivityTypes_Company_Code
    ON dbo.ActivityTypes (CompanyId, Code) WHERE IsDeleted = 0;
END
GO

IF OBJECT_ID('dbo.Accounts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Accounts (
    Id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Accounts PRIMARY KEY,
    CompanyId      INT            NOT NULL,
    Name           NVARCHAR(200)  NOT NULL,
    PhoneNumber    NVARCHAR(30)   NULL,
    Email          NVARCHAR(255)  NULL,
    Address        NVARCHAR(500)  NULL,
    City           NVARCHAR(100)  NULL,
    State          NVARCHAR(100)  NULL,
    Country        NVARCHAR(100)  NULL,
    Latitude       DECIMAL(10,7)  NULL,
    Longitude      DECIMAL(10,7)  NULL,
    PhotoUrl       NVARCHAR(500)  NULL,
    Notes          NVARCHAR(1000) NULL,
    ExtraFields    NVARCHAR(MAX)  NULL,
    LegacyDoctorId INT            NULL,
    IsActive       BIT            NOT NULL CONSTRAINT DF_Accounts_IsActive DEFAULT 1,
    CreatedAtUtc   DATETIME2(3)   NOT NULL CONSTRAINT DF_Accounts_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy      INT            NULL,
    UpdatedAtUtc   DATETIME2(3)   NOT NULL CONSTRAINT DF_Accounts_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy      INT            NULL,
    IsDeleted      BIT            NOT NULL CONSTRAINT DF_Accounts_IsDeleted DEFAULT 0,
    ValidFromUtc   DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidToUtc     DATETIME2(3) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc),
    CONSTRAINT FK_Accounts_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT UQ_Accounts_Company_Id UNIQUE (CompanyId, Id),
    CONSTRAINT CK_Accounts_ExtraFields CHECK (ExtraFields IS NULL OR ISJSON(ExtraFields) = 1),
    CONSTRAINT CK_Accounts_Latitude CHECK (Latitude IS NULL OR Latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_Accounts_Longitude CHECK (Longitude IS NULL OR Longitude BETWEEN -180 AND 180)
  )
  WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.AccountsHistory));
  CREATE INDEX IX_Accounts_Company_Name ON dbo.Accounts (CompanyId, Name) WHERE IsDeleted = 0;
  CREATE UNIQUE INDEX UX_Accounts_LegacyDoctorId ON dbo.Accounts (LegacyDoctorId) WHERE LegacyDoctorId IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.Activities', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Activities (
    Id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Activities PRIMARY KEY,
    CompanyId      INT            NOT NULL,
    ActivityTypeId INT            NOT NULL,
    AccountId      INT            NOT NULL,
    AssignedTo     INT            NOT NULL,
    AssignedBy     INT            NOT NULL,
    Title          NVARCHAR(300)  NOT NULL,
    Description    NVARCHAR(2000) NULL,
    Status         NVARCHAR(20)   NOT NULL CONSTRAINT DF_Activities_Status DEFAULT N'Pending',
    Priority       NVARCHAR(10)   NOT NULL CONSTRAINT DF_Activities_Priority DEFAULT N'Medium',
    DueAtUtc       DATETIME2(3)   NULL,
    CompletedAtUtc DATETIME2(3)   NULL,
    LegacyTaskId   INT            NULL,
    CreatedAtUtc   DATETIME2(3)   NOT NULL CONSTRAINT DF_Activities_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy      INT            NULL,
    UpdatedAtUtc   DATETIME2(3)   NOT NULL CONSTRAINT DF_Activities_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy      INT            NULL,
    IsDeleted      BIT            NOT NULL CONSTRAINT DF_Activities_IsDeleted DEFAULT 0,
    ValidFromUtc   DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidToUtc     DATETIME2(3) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc),
    CONSTRAINT UQ_Activities_Company_Id UNIQUE (CompanyId, Id),
    CONSTRAINT FK_Activities_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT FK_Activities_ActivityTypes FOREIGN KEY (CompanyId, ActivityTypeId)
      REFERENCES dbo.ActivityTypes (CompanyId, Id),
    CONSTRAINT FK_Activities_Accounts FOREIGN KEY (CompanyId, AccountId)
      REFERENCES dbo.Accounts (CompanyId, Id),
    CONSTRAINT FK_Activities_AssignedTo FOREIGN KEY (AssignedTo) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_Activities_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Activities_Status CHECK (Status IN (
      N'Pending', N'InProgress', N'Completed', N'Cancelled', N'Missed')),
    CONSTRAINT CK_Activities_Priority CHECK (Priority IN (N'Low', N'Medium', N'High'))
  )
  WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.ActivitiesHistory));
  CREATE INDEX IX_Activities_Company_AssignedTo_Status
    ON dbo.Activities (CompanyId, AssignedTo, Status) WHERE IsDeleted = 0;
  CREATE INDEX IX_Activities_Company_Account ON dbo.Activities (CompanyId, AccountId) WHERE IsDeleted = 0;
  CREATE UNIQUE INDEX UX_Activities_LegacyTaskId ON dbo.Activities (LegacyTaskId) WHERE LegacyTaskId IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.Submissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Submissions (
    Id                       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Submissions PRIMARY KEY,
    CompanyId                INT            NOT NULL,
    ActivityId               INT            NOT NULL,
    SubmittedBy              INT            NOT NULL,
    CheckInAtUtc             DATETIME2(3)   NULL,
    CheckInLatitude          DECIMAL(10,7)  NULL,
    CheckInLongitude         DECIMAL(10,7)  NULL,
    CheckOutAtUtc            DATETIME2(3)   NULL,
    CheckOutLatitude         DECIMAL(10,7)  NULL,
    CheckOutLongitude        DECIMAL(10,7)  NULL,
    PhotoUrl                 NVARCHAR(500)  NULL,
    SignatureUrl             NVARCHAR(500)  NULL,
    CustomerOtpVerifiedAtUtc DATETIME2(3)   NULL,
    Notes                    NVARCHAR(3000) NULL,
    Rating                   TINYINT        NULL,
    Answers                  NVARCHAR(MAX)  NULL,
    ReviewStatus             NVARCHAR(20)   NOT NULL CONSTRAINT DF_Submissions_ReviewStatus DEFAULT N'Pending',
    ReviewedBy               INT            NULL,
    ReviewedAtUtc            DATETIME2(3)   NULL,
    ReviewComment            NVARCHAR(1000) NULL,
    SubmittedAtUtc           DATETIME2(3)   NOT NULL CONSTRAINT DF_Submissions_SubmittedAtUtc DEFAULT GETUTCDATE(),
    LegacyTaskFeedbackId     INT            NULL,
    CreatedAtUtc             DATETIME2(3)   NOT NULL CONSTRAINT DF_Submissions_CreatedAtUtc DEFAULT GETUTCDATE(),
    CreatedBy                INT            NULL,
    UpdatedAtUtc             DATETIME2(3)   NOT NULL CONSTRAINT DF_Submissions_UpdatedAtUtc DEFAULT GETUTCDATE(),
    UpdatedBy                INT            NULL,
    IsDeleted                BIT            NOT NULL CONSTRAINT DF_Submissions_IsDeleted DEFAULT 0,
    ValidFromUtc             DATETIME2(3) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidToUtc               DATETIME2(3) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc),
    CONSTRAINT FK_Submissions_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id),
    CONSTRAINT FK_Submissions_Activities FOREIGN KEY (CompanyId, ActivityId)
      REFERENCES dbo.Activities (CompanyId, Id),
    CONSTRAINT FK_Submissions_SubmittedBy FOREIGN KEY (SubmittedBy) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_Submissions_ReviewedBy FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users (Id),
    CONSTRAINT CK_Submissions_Rating CHECK (Rating IS NULL OR Rating BETWEEN 1 AND 5),
    CONSTRAINT CK_Submissions_Answers CHECK (Answers IS NULL OR ISJSON(Answers) = 1),
    CONSTRAINT CK_Submissions_ReviewStatus CHECK (ReviewStatus IN (N'Pending', N'Approved', N'Rejected'))
  )
  WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.SubmissionsHistory));
  CREATE INDEX IX_Submissions_Company_Activity ON dbo.Submissions (CompanyId, ActivityId) WHERE IsDeleted = 0;
  CREATE INDEX IX_Submissions_Company_Review ON dbo.Submissions (CompanyId, ReviewStatus) WHERE IsDeleted = 0;
  CREATE UNIQUE INDEX UX_Submissions_LegacyTaskFeedbackId
    ON dbo.Submissions (LegacyTaskFeedbackId) WHERE LegacyTaskFeedbackId IS NOT NULL;
END
GO

-- SSMS guard: when the whole file is run with F5 in SSMS, stop here so the DOWN section
-- below is compiled but not executed. The migration runner (node-mssql) is not SSMS, so
-- this does nothing there. The last line of the file switches execution back on.
IF APP_NAME() LIKE N'Microsoft SQL Server Management Studio%'
  SET NOEXEC ON;
GO

-- ==== DOWN ====

-- WARNING: dropping these tables deletes their data and change history.
IF OBJECT_ID('dbo.Submissions', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.Submissions SET (SYSTEM_VERSIONING = OFF);
  DROP TABLE dbo.Submissions;
  DROP TABLE IF EXISTS dbo.SubmissionsHistory;
END
GO

IF OBJECT_ID('dbo.Activities', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.Activities SET (SYSTEM_VERSIONING = OFF);
  DROP TABLE dbo.Activities;
  DROP TABLE IF EXISTS dbo.ActivitiesHistory;
END
GO

IF OBJECT_ID('dbo.Accounts', 'U') IS NOT NULL
BEGIN
  ALTER TABLE dbo.Accounts SET (SYSTEM_VERSIONING = OFF);
  DROP TABLE dbo.Accounts;
  DROP TABLE IF EXISTS dbo.AccountsHistory;
END
GO

DROP TABLE IF EXISTS dbo.ActivityTypes;
GO

DROP TABLE IF EXISTS dbo.CustomFieldDefinitions;
GO

DROP TABLE IF EXISTS dbo.CompanyTerminology;
GO

SET NOEXEC OFF;
GO
