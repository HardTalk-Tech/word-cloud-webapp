import type { NextConfig } from "next";
import { DEFAULT_EVENT } from "./src/config/events";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Shortcut URLs. Done here rather than with redirect() in a page, so there is no page to prerender.
  redirects() {
    return [
      { source: "/", destination: `/e/${DEFAULT_EVENT}`, permanent: false },
      { source: "/control", destination: `/control/${DEFAULT_EVENT}`, permanent: false },
    ];
  },
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
