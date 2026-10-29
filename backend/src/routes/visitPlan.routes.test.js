/* eslint-disable @stylistic/max-len -- readable one-line fixture rows and test names */
process.env.CRON_SECRET = "test-cron-secret";

jest.mock("../services/visitPlan.service");
jest.mock("../services/missedVisits.service");
jest.mock("../services/report.service");

const request = require("supertest");
const app = require("../app");
const visitPlanService = require("../services/visitPlan.service");
const missedVisitsService = require("../services/missedVisits.service");
const reportService = require("../services/report.service");
const { XHR, USERS, authCookie } = require("../../test/helpers/apiHarness");

function call(method, url, user) {
  const req = request(app)[method](`/api/v1${url}`).set(XHR);
  return user ? req.set("Cookie", authCookie(user)) : req;
}

beforeEach(() => {
  jest.clearAllMocks();
  visitPlanService.preview.mockResolvedValue({ totals: { toCreate: 2 } });
  visitPlanService.generate.mockResolvedValue({ month: "2026-11", created: 2 });
  missedVisitsService.markMissed.mockResolvedValue({ marked: 3, companies: 1 });
  reportService.coverage.mockResolvedValue({ totals: {} });
  reportService.trend.mockResolvedValue([]);
});

describe("visit plan routes", () => {
  it("lets a manager preview and generate a plan", async () => {
    // Act
    const preview = await call("post", "/visit-plans/preview", USERS.manager).send({ month: "2026-11" });
    const created = await call("post", "/visit-plans", USERS.manager).send({ month: "2026-11" });

    // Assert
    expect(preview.status).toBe(200);
    expect(created.status).toBe(201);
    expect(created.body.message).toBe("2 planned visit(s) created.");
  });

  it("forbids an employee from generating a plan", async () => {
    // Act
    const res = await call("post", "/visit-plans", USERS.employee).send({ month: "2026-11" });

    // Assert
    expect(res.status).toBe(403);
    expect(visitPlanService.generate).not.toHaveBeenCalled();
  });

  it("rejects a malformed month or unknown fields", async () => {
    // Act
    const badMonth = await call("post", "/visit-plans/preview", USERS.admin).send({ month: "2026-13" });
    const extra = await call("post", "/visit-plans/preview", USERS.admin).send({ month: "2026-11", x: 1 });

    // Assert
    expect(badMonth.status).toBe(400);
    expect(extra.status).toBe(400);
  });

  it("runs the missed-visits job for the admin's own company only", async () => {
    // Act
    const res = await call("post", "/visit-plans/mark-missed", USERS.admin).send({ companyId: 99 });

    // Assert
    expect(res.status).toBe(200);
    expect(missedVisitsService.markMissed.mock.calls[0][0]).toMatchObject({ companyId: 2, performedBy: 10 });
  });

  it("lets a super admin run it for all companies", async () => {
    // Act
    await call("post", "/visit-plans/mark-missed", USERS.superAdmin).send({});

    // Assert
    expect(missedVisitsService.markMissed.mock.calls[0][0]).toMatchObject({ companyId: null });
  });

  it("forbids a manager from running the missed-visits job", async () => {
    // Act
    const res = await call("post", "/visit-plans/mark-missed", USERS.manager).send({});

    // Assert
    expect(res.status).toBe(403);
  });
});

describe("report routes", () => {
  it("serves coverage and trend to any signed-in role", async () => {
    // Act
    const coverage = await call("get", "/reports/coverage?month=2026-10", USERS.employee);
    const trend = await call("get", "/reports/trend?weeks=4", USERS.employee);

    // Assert
    expect(coverage.status).toBe(200);
    expect(trend.status).toBe(200);
    expect(reportService.coverage.mock.calls[0][1]).toMatchObject({ month: "2026-10" });
    expect(reportService.trend.mock.calls[0][1]).toMatchObject({ weeks: 4 });
  });

  it("requires login", async () => {
    // Act
    const res = await call("get", "/reports/coverage");

    // Assert
    expect(res.status).toBe(401);
  });
});

describe("cron job route", () => {
  it("runs the job with the right bearer secret and no login cookie", async () => {
    // Act
    const res = await request(app).get("/api/v1/jobs/missed-visits")
      .set("Authorization", "Bearer test-cron-secret");

    // Assert
    expect(res.status).toBe(200);
    expect(missedVisitsService.markMissed).toHaveBeenCalledWith();
  });

  it.each([undefined, "Bearer wrong", "test-cron-secret"])("rejects authorization %p", async (header) => {
    // Act
    const req = request(app).get("/api/v1/jobs/missed-visits");
    const res = await (header ? req.set("Authorization", header) : req);

    // Assert
    expect(res.status).toBe(401);
    expect(missedVisitsService.markMissed).not.toHaveBeenCalled();
  });

  it("does not exist when CRON_SECRET is not configured", async () => {
    // Arrange
    let isolatedApp;
    jest.isolateModules(() => {
      delete process.env.CRON_SECRET;
      // eslint-disable-next-line n/global-require -- reload the app without the secret
      isolatedApp = require("../app");
    });
    process.env.CRON_SECRET = "test-cron-secret";

    // Act
    const res = await request(isolatedApp).get("/api/v1/jobs/missed-visits")
      .set("Authorization", "Bearer ");

    // Assert
    expect(res.status).toBe(404);
  });
});
