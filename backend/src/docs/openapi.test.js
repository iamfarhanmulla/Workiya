/* eslint-disable @stylistic/max-len -- readable one-line expectations */
const express = require("express");
const { z } = require("zod");
const { buildOpenApiSpec, openApiSpec, humanize } = require("./openapi");
const { PUBLIC_MOUNTS, PRIVATE_MOUNTS } = require("../routes/mounts");
const { validate } = require("../middleware/validate");
const { authorize } = require("../middleware/authorize");

function operations(spec) {
  return Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods)
    .map(([method, op]) => ({ key: `${method.toUpperCase()} ${path}`, op })));
}

function routeCount(mounts) {
  return mounts.reduce((sum, { router }) => sum + router.stack
    .filter((layer) => layer.route)
    .reduce((n, layer) => n + Object.keys(layer.route.methods).length, 0), 0);
}

describe("OpenAPI spec of the real API", () => {
  const spec = openApiSpec();
  const ops = Object.fromEntries(operations(spec).map(({ key, op }) => [key, op]));

  it("documents every route of every mounted router", () => {
    // Assert
    expect(operations(spec)).toHaveLength(routeCount([...PUBLIC_MOUNTS, ...PRIVATE_MOUNTS]));
    const tags = new Set(spec.tags.map((tag) => tag.name));
    operations(spec).forEach(({ op }) => expect(tags.has(op.tags[0])).toBe(true));
  });

  it("reads roles, the body schema and the cookie login from the route", () => {
    // Act
    const preview = ops["POST /visit-plans/preview"];

    // Assert
    expect(preview.description).toBe("Roles: SUPER_ADMIN, ADMIN, MANAGER.");
    expect(preview.requestBody.content["application/json"].schema.properties.month).toBeDefined();
    expect(preview.security).toEqual([{ cookieAuth: [] }]);
    expect(preview.responses[400]).toBeDefined();
  });

  it("turns query and path validators into parameters", () => {
    // Assert
    expect(ops["GET /reports/coverage"].parameters.map((p) => p.name)).toContain("month");
    expect(ops["GET /reports/coverage"].description).toBe("Any signed-in user.");
    expect(ops["GET /accounts/{id}"].parameters[0]).toMatchObject({ name: "id", in: "path", required: true });
  });

  it("marks login public, /auth/me signed-in, router-level roles and the cron job's bearer", () => {
    // Assert
    expect(ops["POST /auth/login"].security).toEqual([]);
    expect(ops["POST /auth/login"].description).toMatch(/^Public/);
    expect(ops["GET /auth/me"].security).toEqual([{ cookieAuth: [] }]);
    expect(ops["GET /companies"].description).toBe("Roles: SUPER_ADMIN.");
    expect(ops["GET /jobs/missed-visits"].security).toEqual([{ cronAuth: [] }]);
  });
});

describe("buildOpenApiSpec", () => {
  it("documents a route's required query fields and its root path", () => {
    // Arrange
    const router = express.Router();
    const listThings = (_req, res) => res.end();
    router.get(
      "/",
      authorize("ADMIN"),
      validate(z.object({ q: z.string(), page: z.coerce.number().optional() }), "query"),
      listThings,
    );

    // Act
    const spec = buildOpenApiSpec({
      publicMounts: [],
      privateMounts: [{ prefix: "/things", router, tag: "Things" }],
    });

    // Assert
    const op = spec.paths["/things"].get;
    expect(op.summary).toBe("List things");
    expect(op.parameters).toEqual([
      expect.objectContaining({ name: "q", in: "query", required: true }),
      expect.objectContaining({ name: "page", in: "query", required: false }),
    ]);
    expect(op.responses[403]).toBeDefined();
  });

  it("humanizes handler names", () => {
    // Assert
    expect(humanize("transferAssignments")).toBe("Transfer assignments");
    expect(humanize(undefined)).toBe("Operation");
  });
});
