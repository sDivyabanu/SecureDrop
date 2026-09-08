import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @node-rs/argon2 ships a native N-API binary — keep it out of the
  // server bundle so Next.js loads it via require() at runtime instead.
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Next.js 16's Proxy buffers request bodies up to 10MB by default and
    // silently truncates anything larger (no error to the client) — raise
    // it above our 25MB upload limit so large uploads reach the route
    // handler intact instead of arriving as a malformed/truncated body.
    proxyClientMaxBodySize: "26mb",
  },
};

export default nextConfig;
