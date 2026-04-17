/**
 * WorKiya — Full Database Migration
 *
 * Creates all tables from scratch:
 *   Companies (renamed from Tenants)
 *   Roles
 *   Users      (CompanyId FK, RoleId FK, ManagerId self-ref)
 *   Doctors
 *   Tasks
 *   TaskFeedback
 *
 * Safe to run multiple times — uses IF NOT EXISTS checks.
 * Run: node src/config/migrate.js
 */

const { connectDb } = require("./db");
const dotenv = require("dotenv");
dotenv.config();

async function migrate() {
  console.log("Connecting to database...");
  const pool = await connectDb();
  console.log("Connected. Running migrations...\n");

  const steps = [
    // ── 1. Companies ──────────────────────────────────────────────────────
    {
      name: "Create Companies table",
      sql: `
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Companies')
        BEGIN
          CREATE TABLE Companies (
            Id             INT IDENTITY(1,1) PRIMARY KEY,
            Name           NVARCHAR(200)  NOT NULL,
            [Key]          NVARCHAR(100)  NOT NULL UNIQUE,
            LogoUrl        NVARCHAR(500)  NULL,
            ContactEmail   NVARCHAR(255)  NULL,
            ContactPhone   NVARCHAR(30)   NULL,
            Address        NVARCHAR(500)  NULL,
            City           NVARCHAR(100)  NULL,
            Country        NVARCHAR(100)  NULL,
            [Plan]         NVARCHAR(50)   NULL,
            Status         INT            NOT NULL DEFAULT 1,
            IsActive       BIT            NOT NULL DEFAULT 1,
            IsDeleted      BIT            NOT NULL DEFAULT 0,
            CreatedAtUtc   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            UpdatedAtUtc   DATETIMEOFFSET NULL
          )
          PRINT 'Companies table created.'
        END
        ELSE
          PRINT 'Companies table already exists.'
      `
    },

    // ── 2. Doctors ────────────────────────────────────────────────────────
    {
      name: "Create Doctors table",
      sql: `
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Doctors')
        BEGIN
          CREATE TABLE Doctors (
            Id             INT IDENTITY(1,1) PRIMARY KEY,
            CompanyId      INT            NULL,
            CreatedBy      INT            NOT NULL,
            Name           NVARCHAR(200)  NOT NULL,
            Specialization NVARCHAR(100)  NULL,
            HospitalName   NVARCHAR(200)  NULL,
            PhoneNumber    NVARCHAR(30)   NULL,
            Email          NVARCHAR(255)  NULL,
            Address        NVARCHAR(500)  NOT NULL,
            City           NVARCHAR(100)  NULL,
            State          NVARCHAR(100)  NULL,
            Country        NVARCHAR(100)  NULL,
            Latitude       DECIMAL(10,7)  NULL,
            Longitude      DECIMAL(10,7)  NULL,
            PhotoUrl       NVARCHAR(500)  NULL,
            Notes          NVARCHAR(1000) NULL,
            IsActive       BIT            NOT NULL DEFAULT 1,
            IsDeleted      BIT            NOT NULL DEFAULT 0,
            CreatedAtUtc   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            UpdatedAtUtc   DATETIMEOFFSET NULL,

            CONSTRAINT FK_Doctors_Companies FOREIGN KEY (CompanyId)
              REFERENCES Companies(Id),
            CONSTRAINT FK_Doctors_CreatedBy FOREIGN KEY (CreatedBy)
              REFERENCES Users(Id)
          )
          PRINT 'Doctors table created.'
        END
        ELSE
          PRINT 'Doctors table already exists.'
      `
    },

    // ── 3. Tasks ──────────────────────────────────────────────────────────
    {
      name: "Create Tasks table",
      sql: `
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tasks')
        BEGIN
          CREATE TABLE Tasks (
            Id           INT IDENTITY(1,1) PRIMARY KEY,
            CompanyId    INT            NULL,
            DoctorId     INT            NOT NULL,
            AssignedTo   INT            NOT NULL,
            AssignedBy   INT            NOT NULL,
            Title        NVARCHAR(300)  NOT NULL,
            Description  NVARCHAR(2000) NULL,
            Status       NVARCHAR(20)   NOT NULL DEFAULT 'Pending',
            Priority     NVARCHAR(10)   NOT NULL DEFAULT 'Medium',
            DueDate      DATETIMEOFFSET NULL,
            CompletedAt  DATETIMEOFFSET NULL,
            IsDeleted    BIT            NOT NULL DEFAULT 0,
            CreatedAtUtc DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            UpdatedAtUtc DATETIMEOFFSET NULL,

            CONSTRAINT FK_Tasks_Companies  FOREIGN KEY (CompanyId)  REFERENCES Companies(Id),
            CONSTRAINT FK_Tasks_Doctors    FOREIGN KEY (DoctorId)   REFERENCES Doctors(Id),
            CONSTRAINT FK_Tasks_AssignedTo FOREIGN KEY (AssignedTo) REFERENCES Users(Id),
            CONSTRAINT FK_Tasks_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES Users(Id),

            CONSTRAINT CHK_Tasks_Status   CHECK (Status   IN ('Pending','InProgress','Completed','Cancelled')),
            CONSTRAINT CHK_Tasks_Priority CHECK (Priority IN ('Low','Medium','High'))
          )
          PRINT 'Tasks table created.'
        END
        ELSE
          PRINT 'Tasks table already exists.'
      `
    },

    // ── 4. TaskFeedback ───────────────────────────────────────────────────
    {
      name: "Create TaskFeedback table",
      sql: `
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TaskFeedback')
        BEGIN
          CREATE TABLE TaskFeedback (
            Id                INT IDENTITY(1,1) PRIMARY KEY,
            TaskId            INT            NOT NULL,
            EmployeeId        INT            NOT NULL,
            DoctorMet         BIT            NOT NULL DEFAULT 0,
            FeedbackText      NVARCHAR(3000) NULL,
            Rating            TINYINT        NULL,
            PhotoUrl          NVARCHAR(500)  NULL,
            CheckInTime       DATETIMEOFFSET NULL,
            CheckOutTime      DATETIMEOFFSET NULL,
            CheckInLatitude   DECIMAL(10,7)  NULL,
            CheckInLongitude  DECIMAL(10,7)  NULL,
            SubmittedAt       DATETIMEOFFSET NULL DEFAULT SYSDATETIMEOFFSET(),

            CONSTRAINT FK_TaskFeedback_Tasks    FOREIGN KEY (TaskId)     REFERENCES Tasks(Id),
            CONSTRAINT FK_TaskFeedback_Employee FOREIGN KEY (EmployeeId) REFERENCES Users(Id),

            CONSTRAINT CHK_TaskFeedback_Rating CHECK (Rating BETWEEN 1 AND 5)
          )
          PRINT 'TaskFeedback table created.'
        END
        ELSE
          PRINT 'TaskFeedback table already exists.'
      `
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const step of steps) {
    try {
      await pool.request().query(step.sql);
      console.log(`  ✓ ${step.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${step.name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${passed} passed, ${failed} failed.`);

  if (failed === 0) {
    console.log("\nTable order & relationships:");
    console.log("  Companies");
    console.log("  └── Doctors     (CompanyId → Companies, CreatedBy → Users)");
    console.log("  └── Tasks       (CompanyId → Companies, DoctorId → Doctors, AssignedTo/By → Users)");
    console.log("       └── TaskFeedback (TaskId → Tasks, EmployeeId → Users)");
  }

  process.exit(failed > 0 ? 1 : 0);
}

migrate().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
