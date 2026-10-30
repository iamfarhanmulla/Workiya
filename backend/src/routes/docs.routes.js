const express = require("express");
const config = require("../config/env");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");

// Swagger UI for the API at /api/v1/docs. Open on a developer's machine; in production only a
// signed-in SUPER_ADMIN may read it, because it lists every endpoint and field.
const SWAGGER = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";
const SCRIPT_SRI = "sha384-wmyclcVGX/WhUkdkATwhaK1X1JtiNrr2EoYJ+diV3vj4v6OC5yCeSu+yW13SYJep";
const STYLE_SRI = "sha384-wxLW6kwyHktdDGr6Pv1zgm/VGJh99lfUbzSn6HNHBENZlCN7W602k9VkGdxuFvPn";
const OPEN_ENVS = ["development", "test"];

// Replaces helmet's default policy for these pages only: Swagger UI comes from the pinned CDN
// files above (checked by their SRI hashes) and needs inline styles.
const DOCS_CSP = [
  "default-src 'none'",
  `script-src 'self' ${SWAGGER}/`,
  `style-src 'unsafe-inline' ${SWAGGER}/`,
  `img-src 'self' data: ${SWAGGER}/`,
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Workiya API</title>
  <link rel="stylesheet" href="${SWAGGER}/swagger-ui.css"
    integrity="${STYLE_SRI}" crossorigin="anonymous">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER}/swagger-ui-bundle.js"
    integrity="${SCRIPT_SRI}" crossorigin="anonymous"></script>
  <script src="/api/v1/docs/init.js"></script>
</body>
</html>
`;

// Absolute paths, so the page works both on the API host and through the frontend's /api proxy.
const INIT = `window.ui = SwaggerUIBundle({
  url: "/api/v1/docs/openapi.json",
  dom_id: "#swagger-ui",
  requestInterceptor: (req) => {
    req.headers["X-Requested-With"] = "XMLHttpRequest";
    return req;
  },
});
`;

function docsHeaders(_req, res, next) {
  res.set("Content-Security-Policy", DOCS_CSP);
  res.set("Cache-Control", "no-store");
  next();
}

function createDocsRouter({ open = OPEN_ENVS.includes(config.nodeEnv) } = {}) {
  const router = express.Router();
  if (!open) router.use(authenticate, authorize(ROLES.SUPER_ADMIN));
  router.use(docsHeaders);
  router.get("/", (_req, res) => res.type("html").send(PAGE));
  router.get("/init.js", (_req, res) => res.type("application/javascript").send(INIT));
  router.get("/openapi.json", (_req, res) => {
    // Loaded on first use: the spec walks every router, which index.js has mounted by then.
    // eslint-disable-next-line n/global-require -- lazy, avoids a require cycle with routes
    const { openApiSpec } = require("../docs/openapi");
    res.json(openApiSpec());
  });
  return router;
}

module.exports = createDocsRouter();
module.exports.createDocsRouter = createDocsRouter;
