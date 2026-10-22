-- Migration: 20261021100100_WI-TBD_copy_pharma_data_to_accounts
-- Purpose : 1) Give every existing company the pharma defaults, so the screens keep
--              showing "Doctor", "Task", "Specialization", "Hospital Name", "Doctor Met".
--           2) Copy Doctors -> Accounts, Tasks -> Activities, TaskFeedback -> Submissions.
--              Old tables are only READ; nothing in them is changed or deleted.
-- Requires: 20261021100000_WI-TBD_create_generic_accounts_activities.sql applied first.
-- Re-run  : Safe. Copied rows are matched through LegacyDoctorId / LegacyTaskId /
--           LegacyTaskFeedbackId and seeded settings through their keys, so nothing is
--           inserted twice.
-- Apply   : cd backend && node scripts/run-sql-migration.js db/migrations/<this file> up --yes
--           In SSMS: pressing F5 on the whole file runs only UP (see the guard below).
-- Revert  : cd backend && node scripts/run-sql-migration.js db/migrations/<this file> down --yes
--           DOWN removes only copied rows and untouched seeded settings. It fails (on
--           purpose, through the foreign keys) if new data was created on top of them.

-- ==== UP ====

INSERT INTO dbo.CompanyTerminology (CompanyId, TermKey, Label)
SELECT c.Id, t.TermKey, t.Label
FROM dbo.Companies c
CROSS JOIN (VALUES
  (N'account.singular', N'Doctor'),
  (N'account.plural', N'Doctors'),
  (N'activity.singular', N'Task'),
  (N'activity.plural', N'Tasks'),
  (N'submission.singular', N'Feedback'),
  (N'submission.plural', N'Feedback')
) AS t (TermKey, Label)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.CompanyTerminology ct
  WHERE ct.CompanyId = c.Id AND ct.TermKey = t.TermKey AND ct.IsDeleted = 0);
GO

INSERT INTO dbo.CustomFieldDefinitions (CompanyId, EntityType, FieldKey, Label, DataType, SortOrder)
SELECT c.Id, f.EntityType, f.FieldKey, f.Label, f.DataType, f.SortOrder
FROM dbo.Companies c
CROSS JOIN (VALUES
  (N'ACCOUNT', N'specialization', N'Specialization', N'TEXT', 10),
  (N'ACCOUNT', N'hospitalName', N'Hospital Name', N'TEXT', 20),
  (N'SUBMISSION', N'doctorMet', N'Doctor Met', N'BOOLEAN', 10)
) AS f (EntityType, FieldKey, Label, DataType, SortOrder)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.CustomFieldDefinitions d
  WHERE d.CompanyId = c.Id AND d.EntityType = f.EntityType
    AND d.FieldKey = f.FieldKey AND d.IsDeleted = 0);
GO

INSERT INTO dbo.ActivityTypes (CompanyId, Code, Name, RequiresCheckIn, GeofenceMeters)
SELECT c.Id, N'DOCTOR_VISIT', N'Doctor Visit', 1, 100
FROM dbo.Companies c
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.ActivityTypes a
  WHERE a.CompanyId = c.Id AND a.Code = N'DOCTOR_VISIT' AND a.IsDeleted = 0);
GO

-- Doctors.Latitude/Longitude are stored as text in the live DB; values that are not valid
-- coordinates become NULL instead of failing the copy.
INSERT INTO dbo.Accounts (
  CompanyId, Name, PhoneNumber, Email, Address, City, State, Country,
  Latitude, Longitude, PhotoUrl, Notes, ExtraFields, LegacyDoctorId,
  IsActive, IsDeleted, CreatedAtUtc, CreatedBy, UpdatedAtUtc)
SELECT
  d.CompanyId, d.Name, d.PhoneNumber, d.Email, d.Address, d.City, d.State, d.Country,
  CASE WHEN TRY_CONVERT(DECIMAL(10,7), d.Latitude) BETWEEN -90 AND 90
       THEN TRY_CONVERT(DECIMAL(10,7), d.Latitude) END,
  CASE WHEN TRY_CONVERT(DECIMAL(10,7), d.Longitude) BETWEEN -180 AND 180
       THEN TRY_CONVERT(DECIMAL(10,7), d.Longitude) END,
  d.PhotoUrl, d.Notes,
  (SELECT d.Specialization AS specialization, d.HospitalName AS hospitalName
   FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
  d.Id,
  d.IsActive, d.IsDeleted,
  CONVERT(DATETIME2(3), SWITCHOFFSET(d.CreatedAtUtc, '+00:00')),
  d.CreatedBy,
  CONVERT(DATETIME2(3), SWITCHOFFSET(COALESCE(d.UpdatedAtUtc, d.CreatedAtUtc), '+00:00'))
FROM dbo.Doctors d
WHERE d.CompanyId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.LegacyDoctorId = d.Id);
GO

-- An activity always belongs to its account's company (the composite foreign key
-- enforces this), so CompanyId comes from the copied account.
INSERT INTO dbo.Activities (
  CompanyId, ActivityTypeId, AccountId, AssignedTo, AssignedBy, Title, Description,
  Status, Priority, DueAtUtc, CompletedAtUtc, LegacyTaskId,
  IsDeleted, CreatedAtUtc, CreatedBy, UpdatedAtUtc)
SELECT
  a.CompanyId, at.Id, a.Id, t.AssignedTo, t.AssignedBy, t.Title, t.Description,
  t.Status, t.Priority,
  CONVERT(DATETIME2(3), SWITCHOFFSET(t.DueDate, '+00:00')),
  CONVERT(DATETIME2(3), SWITCHOFFSET(t.CompletedAt, '+00:00')),
  t.Id,
  t.IsDeleted,
  CONVERT(DATETIME2(3), SWITCHOFFSET(t.CreatedAtUtc, '+00:00')),
  t.AssignedBy,
  CONVERT(DATETIME2(3), SWITCHOFFSET(COALESCE(t.UpdatedAtUtc, t.CreatedAtUtc), '+00:00'))
FROM dbo.Tasks t
JOIN dbo.Accounts a ON a.LegacyDoctorId = t.DoctorId
JOIN dbo.ActivityTypes at ON at.CompanyId = a.CompanyId AND at.Code = N'DOCTOR_VISIT' AND at.IsDeleted = 0
WHERE NOT EXISTS (SELECT 1 FROM dbo.Activities x WHERE x.LegacyTaskId = t.Id);
GO

INSERT INTO dbo.Submissions (
  CompanyId, ActivityId, SubmittedBy,
  CheckInAtUtc, CheckInLatitude, CheckInLongitude, CheckOutAtUtc,
  PhotoUrl, Notes, Rating, Answers, SubmittedAtUtc, LegacyTaskFeedbackId, CreatedBy)
SELECT
  act.CompanyId, act.Id, f.EmployeeId,
  CONVERT(DATETIME2(3), SWITCHOFFSET(f.CheckInTime, '+00:00')),
  f.CheckInLatitude, f.CheckInLongitude,
  CONVERT(DATETIME2(3), SWITCHOFFSET(f.CheckOutTime, '+00:00')),
  f.PhotoUrl, f.FeedbackText, f.Rating,
  (SELECT f.DoctorMet AS doctorMet FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
  COALESCE(CONVERT(DATETIME2(3), SWITCHOFFSET(f.SubmittedAt, '+00:00')), GETUTCDATE()),
  f.Id,
  f.EmployeeId
FROM dbo.TaskFeedback f
JOIN dbo.Activities act ON act.LegacyTaskId = f.TaskId
WHERE NOT EXISTS (SELECT 1 FROM dbo.Submissions s WHERE s.LegacyTaskFeedbackId = f.Id);
GO

-- Verification: every source row must have been copied. The runner rolls everything back
-- if this fails; in SSMS the error message names what is missing.
DECLARE @missingDoctors INT = (
  SELECT COUNT(*) FROM dbo.Doctors d
  WHERE d.CompanyId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.LegacyDoctorId = d.Id));
DECLARE @missingTasks INT = (
  SELECT COUNT(*) FROM dbo.Tasks t
  WHERE NOT EXISTS (SELECT 1 FROM dbo.Activities a WHERE a.LegacyTaskId = t.Id));
DECLARE @missingFeedback INT = (
  SELECT COUNT(*) FROM dbo.TaskFeedback f
  WHERE NOT EXISTS (SELECT 1 FROM dbo.Submissions s WHERE s.LegacyTaskFeedbackId = f.Id));
DECLARE @doctorsWithoutCompany INT = (SELECT COUNT(*) FROM dbo.Doctors WHERE CompanyId IS NULL);

IF @missingDoctors + @missingTasks + @missingFeedback > 0
BEGIN
  DECLARE @message NVARCHAR(400) = CONCAT(
    N'Copy incomplete. Doctors not copied: ', @missingDoctors,
    N', Tasks not copied: ', @missingTasks,
    N', TaskFeedback not copied: ', @missingFeedback,
    N'. Doctors without a company (never copied): ', @doctorsWithoutCompany, N'.');
  THROW 51010, @message, 1;
END;

DECLARE @copiedAccounts INT = (SELECT COUNT(*) FROM dbo.Accounts WHERE LegacyDoctorId IS NOT NULL);
DECLARE @copiedActivities INT = (SELECT COUNT(*) FROM dbo.Activities WHERE LegacyTaskId IS NOT NULL);
DECLARE @copiedSubmissions INT = (
  SELECT COUNT(*) FROM dbo.Submissions WHERE LegacyTaskFeedbackId IS NOT NULL);
DECLARE @summary NVARCHAR(400) = CONCAT(
  N'Copied OK. Accounts from Doctors: ', @copiedAccounts,
  N', Activities from Tasks: ', @copiedActivities,
  N', Submissions from TaskFeedback: ', @copiedSubmissions, N'.');
PRINT @summary;
GO

-- SSMS guard: when the whole file is run with F5 in SSMS, stop here so the DOWN section
-- below is compiled but not executed. The last line of the file switches execution back on.
IF APP_NAME() LIKE N'Microsoft SQL Server Management Studio%'
  SET NOEXEC ON;
GO

-- ==== DOWN ====

DELETE FROM dbo.Submissions WHERE LegacyTaskFeedbackId IS NOT NULL;
GO

DELETE FROM dbo.Activities WHERE LegacyTaskId IS NOT NULL;
GO

DELETE FROM dbo.Accounts WHERE LegacyDoctorId IS NOT NULL;
GO

-- Seeded settings have CreatedBy NULL; anything a user created or edited in the app is kept.
DELETE FROM dbo.ActivityTypes
WHERE Code = N'DOCTOR_VISIT' AND CreatedBy IS NULL AND UpdatedBy IS NULL;
GO

DELETE FROM dbo.CustomFieldDefinitions
WHERE CreatedBy IS NULL AND UpdatedBy IS NULL
  AND FieldKey IN (N'specialization', N'hospitalName', N'doctorMet');
GO

DELETE FROM dbo.CompanyTerminology
WHERE CreatedBy IS NULL AND UpdatedBy IS NULL;
GO

SET NOEXEC OFF;
GO
