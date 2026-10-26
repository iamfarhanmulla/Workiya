import axios from "axios";

const AUTH_ENDPOINTS = ["/auth/login", "/auth/refresh", "/auth/logout"];
const REFRESHABLE_CODES = ["AUTH_TOKEN_EXPIRED", "AUTH_REQUIRED"];
const SESSION_ENDED_CODES = ["AUTH_REFRESH_INVALID", "AUTH_REFRESH_REUSED"];

export const api = axios.create({
  // Empty NEXT_PUBLIC_API_URL means "same site" (Vercel: forwarded by next.config rewrites).
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1`,
  withCredentials: true,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

let sessionExpiredHandler = null;
let refreshPromise = null;

export function setSessionExpiredHandler(fn) {
  sessionExpiredHandler = typeof fn === "function" ? fn : null;
}

export function getErrorMessage(err, fallback) {
  const message = err?.response?.data?.message;
  if (message) return message;
  if (!err?.response) return "Cannot connect to server.";
  return fallback;
}

function isAuthEndpoint(url = "") {
  const path = url.split("?")[0];
  return AUTH_ENDPOINTS.some((endpoint) => path.endsWith(endpoint));
}

function shouldRefresh(error) {
  const { config, response } = error;
  if (!config || !response || config.wkRetried) return false;
  if (response.status !== 401) return false;
  if (!REFRESHABLE_CODES.includes(response.data?.errorCode)) return false;
  return !isAuthEndpoint(config.url);
}

function notifySessionExpired() {
  if (sessionExpiredHandler) sessionExpiredHandler();
}

// Only a refresh the server rejected ends the session. A network error, 429 or 5xx
// fails the current request but keeps the session for the next try.
function isSessionRejected(refreshError) {
  const { response } = refreshError;
  return response?.status === 401 && SESSION_ENDED_CODES.includes(response.data?.errorCode);
}

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .catch((refreshError) => {
        if (isSessionRejected(refreshError)) notifySessionExpired();
        throw refreshError;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function handleResponseError(error) {
  if (!shouldRefresh(error)) throw error;
  const originalRequest = error.config;
  originalRequest.wkRetried = true;
  try {
    await refreshSession();
  } catch {
    throw error;
  }
  return api(originalRequest);
}

api.interceptors.response.use((response) => response, handleResponseError);
