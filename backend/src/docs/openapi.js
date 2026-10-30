const { z } = require("zod");
const { PUBLIC_MOUNTS, PRIVATE_MOUNTS } = require("../routes/mounts");

// Builds the OpenAPI 3.0 description of /api/v1 by walking the real Express routers: paths
// and methods come from the routes, roles from authorize(), inputs from validate()'s zod
// schemas. Nothing is listed by hand, so the docs cannot drift from the code.
const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);
const COOKIE_AUTH = [{ cookieAuth: [] }];

const INTRO = [
  "Every response uses the wrapper `{ success, data, message, errorCode, timestamp }`.",
  "",
  "**Try it out:** call `POST /auth/login` first. The login cookies are then sent with every",
  "request from this page. The `X-Requested-With` header that POST/PUT/PATCH/DELETE need is",
  "added automatically.",
].join("\n");

function toSchema(schema) {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0", io: "input", unrepresentable: "any",
  });
  delete json.$schema;
  return json;
}

// "transferAssignments" -> "Transfer assignments"
function humanize(name) {
  const words = (name || "operation").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function inputsOf(handlers) {
  return Object.fromEntries(handlers
    .filter((handler) => handler.openapi)
    .map((handler) => [handler.openapi.source, toSchema(handler.openapi.schema)]));
}

function parameters(path, inputs) {
  const names = [...path.matchAll(/:(\w+)/g)].map((match) => match[1]);
  const pathParams = names.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: inputs.params?.properties?.[name] || { type: "string" },
  }));
  const query = inputs.query?.properties || {};
  const required = new Set(inputs.query?.required || []);
  const queryParams = Object.entries(query).map(([name, schema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema,
  }));
  return [...pathParams, ...queryParams];
}

function access({ roles, isPublic, cron }) {
  if (cron) return "Vercel Cron only: `Authorization: Bearer <CRON_SECRET>`.";
  if (isPublic) return "Public: no login needed.";
  return roles ? `Roles: ${roles.join(", ")}.` : "Any signed-in user.";
}

function responses({
  inputs, isPublic, roles, method,
}) {
  const wrapper = (description) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } },
  });
  const result = { 200: wrapper("Success (201 for creates)") };
  if (inputs.body || inputs.query || inputs.params) result[400] = wrapper("VALIDATION_FAILED");
  if (!isPublic) result[401] = wrapper("Not signed in or session expired");
  if (roles || UNSAFE_METHODS.has(method)) {
    result[403] = wrapper("FORBIDDEN or CSRF_HEADER_MISSING");
  }
  result.default = wrapper("Other errors (404, 409, 429, 500)");
  return result;
}

function security({ isPublic, cron }) {
  if (cron) return [{ cronAuth: [] }];
  return isPublic ? [] : COOKIE_AUTH;
}

function operation(mount, route, method, routerRoles) {
  const handlers = route.stack.map((layer) => layer.handle);
  const roles = handlers.find((handler) => handler.roles)?.roles || routerRoles;
  const inputs = inputsOf(handlers);
  const cron = mount.tag === "Jobs";
  const isPublic = mount.isPublic && !handlers.some((handler) => handler.name === "authenticate");
  const op = {
    tags: [mount.tag],
    summary: humanize(handlers[handlers.length - 1].name),
    description: access({ roles, isPublic, cron }),
    parameters: parameters(route.path, inputs),
    responses: responses({
      inputs, isPublic, roles, method,
    }),
    security: security({ isPublic, cron }),
  };
  if (inputs.body) {
    op.requestBody = { required: true, content: { "application/json": { schema: inputs.body } } };
  }
  return op;
}

function toOpenApiPath(prefix, path) {
  const full = path === "/" ? prefix : `${prefix}${path}`;
  return full.replace(/:(\w+)/g, "{$1}");
}

// [path, method, operation] for each route of one router. A router-level authorize()
// (router.use(authorize(...))) applies to the routes after it.
function mountOperations(mount) {
  let routerRoles = null;
  return mount.router.stack.flatMap((layer) => {
    if (!layer.route) {
      if (layer.handle.roles) routerRoles = layer.handle.roles;
      return [];
    }
    const path = toOpenApiPath(mount.prefix, layer.route.path);
    return Object.keys(layer.route.methods)
      .filter((method) => method !== "_all")
      .map((method) => [path, method, operation(mount, layer.route, method, routerRoles)]);
  });
}

const COMPONENTS = Object.freeze({
  securitySchemes: {
    cookieAuth: {
      type: "apiKey", in: "cookie", name: "wk_at", description: "Set by POST /auth/login.",
    },
    cronAuth: { type: "http", scheme: "bearer" },
  },
  schemas: {
    ApiResponse: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: { nullable: true },
        message: { type: "string" },
        errorCode: { type: "string", nullable: true },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  },
});

function buildOpenApiSpec(mounts = {
  publicMounts: PUBLIC_MOUNTS, privateMounts: PRIVATE_MOUNTS,
}) {
  const all = [
    ...mounts.publicMounts.map((mount) => ({ ...mount, isPublic: true })),
    ...mounts.privateMounts.map((mount) => ({ ...mount, isPublic: false })),
  ];
  const paths = all.flatMap(mountOperations).reduce((acc, [path, method, op]) => ({
    ...acc, [path]: { ...acc[path], [method]: op },
  }), {});
  return {
    openapi: "3.0.3",
    info: { title: "Workiya API", version: "v1", description: INTRO },
    servers: [{ url: "/api/v1" }],
    tags: [...mounts.publicMounts, ...mounts.privateMounts].map(({ tag }) => ({ name: tag })),
    paths,
    components: COMPONENTS,
  };
}

let cached;

// The routes never change while the process runs, so the spec is built once.
function openApiSpec() {
  cached = cached || buildOpenApiSpec();
  return cached;
}

module.exports = { buildOpenApiSpec, openApiSpec, humanize };
