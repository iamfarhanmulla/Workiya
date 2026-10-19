const config = require("../config/env");

const COOKIE_NAMES = Object.freeze({
  ACCESS: "wk_at",
  REFRESH: "wk_rt",
  SESSION: "wk_session",
});

const REFRESH_PATH = "/api/v1/auth";
const DAY_MS = 24 * 60 * 60 * 1000;

function baseOptions(path) {
  const options = {
    httpOnly: true,
    sameSite: "strict",
    secure: config.secureCookies,
    path,
  };
  if (config.cookieDomain) {
    options.domain = config.cookieDomain;
  }
  return options;
}

function refreshLifetime(isPersistent, refreshExpiresAt) {
  if (!isPersistent) {
    return {};
  }
  const maxAge = refreshExpiresAt
    ? Math.max(0, new Date(refreshExpiresAt).getTime() - Date.now())
    : config.refresh.persistentDays * DAY_MS;
  return { maxAge };
}

function setAuthCookies(res, {
  accessToken, refreshToken, isPersistent, refreshExpiresAt,
}) {
  const lifetime = refreshLifetime(isPersistent, refreshExpiresAt);
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, {
    ...baseOptions("/"),
    maxAge: config.jwt.accessTtlSeconds * 1000,
  });
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, {
    ...baseOptions(REFRESH_PATH),
    ...lifetime,
  });
  res.cookie(COOKIE_NAMES.SESSION, "1", {
    ...baseOptions("/"),
    ...lifetime,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIE_NAMES.ACCESS, baseOptions("/"));
  res.clearCookie(COOKIE_NAMES.REFRESH, baseOptions(REFRESH_PATH));
  res.clearCookie(COOKIE_NAMES.SESSION, baseOptions("/"));
}

module.exports = {
  COOKIE_NAMES, REFRESH_PATH, setAuthCookies, clearAuthCookies,
};
