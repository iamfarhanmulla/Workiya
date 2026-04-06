const crypto = require("crypto");
const { connectDb, sql } = require("../config/db");

function hashPassword(password, saltBase64, iterations) {
  const salt = Buffer.from(saltBase64, "base64");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return hash.toString("base64");
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    const pool = await connectDb();

    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query(`
        SELECT
          Id, TenantId, Username, Email, DisplayName,
          PasswordHash, PasswordSalt, PasswordIterations,
          FirstName, MiddleName, LastName, Status,
          PhoneNumber, IsActive, IsDeleted
        FROM Users
        WHERE Email = @email
          AND IsActive = 1
          AND IsDeleted = 0
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = result.recordset[0];

    const computedHash = hashPassword(password, user.PasswordSalt, user.PasswordIterations);
    if (computedHash !== user.PasswordHash) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.Id,
        tenantId: user.TenantId,
        username: user.Username,
        email: user.Email,
        displayName: user.DisplayName,
        firstName: user.FirstName,
        middleName: user.MiddleName,
        lastName: user.LastName,
        status: user.Status,
        phoneNumber: user.PhoneNumber
      }
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ success: false, message: "Database error. Please try again." });
  }
}

module.exports = { login };
