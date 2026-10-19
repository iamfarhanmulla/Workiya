const { z } = require("zod");
const { validate } = require("./validate");
const { mockResponse } = require("../../test/helpers/mockResponse");

const schema = z.object({
  email: z.string().trim().pipe(z.email()),
  age: z.number().int().optional()
});

describe("validate middleware", () => {
  it("replaces req.body with parsed data and calls next", () => {
    // Arrange
    const req = { body: { email: "  a@b.co ", extra: "dropped" } };
    const next = jest.fn();

    // Act
    validate(schema)(req, mockResponse(), next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ email: "a@b.co" });
  });

  it("returns 400 VALIDATION_FAILED with field messages", () => {
    // Arrange
    const req = { body: { email: "not-an-email", age: "x" } };
    const res = mockResponse();
    const next = jest.fn();

    // Act
    validate(schema)(req, res, next);

    // Assert
    const body = res.json.mock.calls[0][0];
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body.errorCode).toBe("VALIDATION_FAILED");
    expect(body.message).toMatch(/email: /);
    expect(body.message).toMatch(/age: /);
  });

  it("treats a missing body as an empty object", () => {
    // Arrange
    const res = mockResponse();

    // Act
    validate(schema)({}, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("reports root-level issues without a field prefix", () => {
    // Arrange
    const res = mockResponse();

    // Act
    validate(z.string())({ body: 42 }, res, jest.fn());

    // Assert
    expect(res.json.mock.calls[0][0].message).not.toMatch(/^: /);
  });

  it("stores non-body sources on req.validated", () => {
    // Arrange
    const req = { query: { page: "2" } };
    const next = jest.fn();

    // Act
    validate(z.object({ page: z.coerce.number() }), "query")(req, mockResponse(), next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(req.validated).toEqual({ query: { page: 2 } });
  });
});
