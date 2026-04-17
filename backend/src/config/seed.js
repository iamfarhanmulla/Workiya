const crypto = require("crypto");
const { connectDb, sql } = require("./db");
const dotenv = require("dotenv");

dotenv.config();

function generateHash(password) {
  const salt = crypto.randomBytes(16);
  const iterations = 10000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return {
    passwordSalt: salt.toString("base64"),
    passwordHash: hash.toString("base64"),
    passwordIterations: iterations
  };
}

async function seed() {
  try {
    const pool = await connectDb();

    const existing = await pool
      .request()
      .input("email", sql.NVarChar, "admin@workiya.com")
      .query("SELECT Id FROM Users WHERE Email = @email");

    if (existing.recordset.length > 0) {
      console.log("Dummy user already exists: admin@workiya.com");
      process.exit(0);
    }

    // Get the SuperAdmin role id
    const roleResult = await pool
      .request()
      .input("roleName", sql.NVarChar, "SuperAdmin")
      .query("SELECT Id FROM Roles WHERE Name = @roleName");

    if (roleResult.recordset.length === 0) {
      console.error("SuperAdmin role not found. Please run migrations first: npm run migrate");
      process.exit(1);
    }

    const roleId = roleResult.recordset[0].Id;

    const { passwordSalt, passwordHash, passwordIterations } = generateHash("Admin@123");

    await pool
      .request()
      .input("roleId",             sql.Int,            roleId)
      .input("username",           sql.NVarChar,       "admin")
      .input("email",              sql.NVarChar,       "admin@workiya.com")
      .input("displayName",        sql.NVarChar,       "Super Admin")
      .input("firstName",          sql.NVarChar,       "Super")
      .input("lastName",           sql.NVarChar,       "Admin")
      .input("passwordHash",       sql.NVarChar,       passwordHash)
      .input("passwordSalt",       sql.NVarChar,       passwordSalt)
      .input("passwordIterations", sql.Int,            passwordIterations)
      .input("status",             sql.Int,            1)
      .input("isActive",           sql.Bit,            1)
      .input("isDeleted",          sql.Bit,            0)
      .input("createdAtUtc",       sql.DateTimeOffset, new Date())
      .query(`
        INSERT INTO Users
          (RoleId, Username, Email, DisplayName, FirstName, LastName,
           PasswordHash, PasswordSalt, PasswordIterations,
           Status, IsActive, IsDeleted, CreatedAtUtc)
        VALUES
          (@roleId, @username, @email, @displayName, @firstName, @lastName,
           @passwordHash, @passwordSalt, @passwordIterations,
           @status, @isActive, @isDeleted, @createdAtUtc)
      `);

    console.log("Super Admin user created successfully!");
    console.log("  Email:    admin@workiya.com");
    console.log("  Password: Admin@123");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
