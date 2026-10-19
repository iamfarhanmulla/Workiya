const argon2 = require("argon2");
const passwordService = require("./password.service");
const { legacyPbkdf2Row } = require("../../test/helpers/pbkdf2");

describe("password.service", () => {
  describe("verifyPassword", () => {
    it("accepts the correct password for a legacy PBKDF2 row", async () => {
      // Arrange
      const row = legacyPbkdf2Row("Correct#Pass1");

      // Act
      const result = await passwordService.verifyPassword(row, "Correct#Pass1");

      // Assert
      expect(result).toBe(true);
    });

    it("rejects a wrong password for a legacy PBKDF2 row", async () => {
      // Arrange
      const row = legacyPbkdf2Row("Correct#Pass1");

      // Act
      const result = await passwordService.verifyPassword(row, "wrong");

      // Assert
      expect(result).toBe(false);
    });

    it("rejects a PBKDF2 row with an empty hash or salt", async () => {
      // Arrange
      const emptyHash = legacyPbkdf2Row("x", { PasswordHash: "" });
      const emptySalt = legacyPbkdf2Row("x", { PasswordSalt: "" });

      // Act
      const results = await Promise.all([
        passwordService.verifyPassword(emptyHash, "x"),
        passwordService.verifyPassword(emptySalt, "x"),
      ]);

      // Assert
      expect(results).toEqual([false, false]);
    });

    it("accepts and rejects Argon2id hashes", async () => {
      // Arrange
      const hashed = await passwordService.hashPassword("Argon#Pass1");
      const row = { PasswordHash: hashed.passwordHash, PasswordSalt: "", PasswordIterations: 0 };

      // Act
      const good = await passwordService.verifyPassword(row, "Argon#Pass1");
      const bad = await passwordService.verifyPassword(row, "nope");

      // Assert
      expect(good).toBe(true);
      expect(bad).toBe(false);
    });

    it("returns false for a malformed Argon2 hash instead of throwing", async () => {
      // Arrange
      const row = { PasswordHash: "$argon2id$broken", PasswordSalt: "", PasswordIterations: 0 };

      // Act
      const result = await passwordService.verifyPassword(row, "anything");

      // Assert
      expect(result).toBe(false);
    });

    it("returns false when the row has no usable scheme or input is missing", async () => {
      // Arrange
      const unknownScheme = { PasswordHash: "abc", PasswordSalt: "", PasswordIterations: 0 };

      // Act
      const results = await Promise.all([
        passwordService.verifyPassword(unknownScheme, "abc"),
        passwordService.verifyPassword(null, "abc"),
        passwordService.verifyPassword(unknownScheme, undefined),
      ]);

      // Assert
      expect(results).toEqual([false, false, false]);
    });
  });

  describe("hashPassword", () => {
    it("produces an argon2id hash with the configured parameters", async () => {
      // Arrange
      const plain = "New#Pass123";

      // Act
      const result = await passwordService.hashPassword(plain);

      // Assert
      expect(result.passwordSalt).toBe("");
      expect(result.passwordIterations).toBe(0);
      const params = result.passwordHash.split("$")[3].split(",").sort();
      expect(result.passwordHash.startsWith("$argon2id$")).toBe(true);
      expect(params).toEqual(["m=19456", "p=1", "t=2"]);
      expect(await argon2.verify(result.passwordHash, plain)).toBe(true);
    });
  });

  describe("needsRehash", () => {
    it("is true for PBKDF2 rows and false for Argon2 rows", () => {
      // Arrange
      const legacy = legacyPbkdf2Row("x");
      const modern = {
        PasswordHash: "$argon2id$v=19$...", PasswordSalt: "", PasswordIterations: 0,
      };

      // Act
      const results = [passwordService.needsRehash(legacy), passwordService.needsRehash(modern)];

      // Assert
      expect(results).toEqual([true, false]);
    });
  });

  describe("dummyVerify", () => {
    it("always resolves to false and reuses its cached hash", async () => {
      // Arrange
      const hashSpy = jest.spyOn(argon2, "hash");

      // Act
      const first = await passwordService.dummyVerify();
      const second = await passwordService.dummyVerify();

      // Assert
      expect(first).toBe(false);
      expect(second).toBe(false);
      expect(hashSpy).toHaveBeenCalledTimes(1);
      hashSpy.mockRestore();
    });

    it("burns a PBKDF2 hash, not Argon2, when asked for the legacy scheme", async () => {
      // Arrange
      const argonSpy = jest.spyOn(argon2, "verify");

      // Act
      const result = await passwordService.dummyVerify(passwordService.PASSWORD_SCHEMES.PBKDF2);

      // Assert
      expect(result).toBe(false);
      expect(argonSpy).not.toHaveBeenCalled();
      argonSpy.mockRestore();
    });
  });

  describe("hashForSharedUsersTable", () => {
    it("produces a PBKDF2 row that verifyPassword accepts", async () => {
      // Arrange
      const hashed = passwordService.hashForSharedUsersTable("Str0ng!Pass");

      // Act
      const ok = await passwordService.verifyPassword({
        PasswordHash: hashed.passwordHash,
        PasswordSalt: hashed.passwordSalt,
        PasswordIterations: hashed.passwordIterations,
      }, "Str0ng!Pass");

      // Assert
      expect(ok).toBe(true);
      expect(hashed.passwordIterations).toBe(10000);
    });
  });

  describe("isAcceptablePassword", () => {
    it.each([
      [undefined, false],
      ["short", false],
      ["x".repeat(257), false],
      ["Employee1", true],
    ])("returns the right answer for %p", (input, expected) => {
      // Arrange / Act
      const result = passwordService.isAcceptablePassword(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
