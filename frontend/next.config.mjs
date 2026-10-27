import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// On Vercel the API is a separate project. With API_ORIGIN set (e.g.
// https://workiya-api.vercel.app), the browser calls /api/... on this site and Next.js
// forwards it, so the login cookies stay first-party. Locally API_ORIGIN is unset and the
// browser calls NEXT_PUBLIC_API_URL (http://localhost:5001) directly.
export function apiRewrites(apiOrigin = process.env.API_ORIGIN) {
  if (!apiOrigin) return [];
  return [{ source: "/api/:path*", destination: `${apiOrigin.replace(/\/+$/, "")}/api/:path*` }];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(currentDir, ".."),
  },
  async rewrites() {
    return apiRewrites();
  },
};

export default nextConfig;
