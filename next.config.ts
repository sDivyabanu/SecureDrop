import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonce-based script-src: that requires every page to opt into dynamic
// rendering (Next.js can only inject a per-request nonce into its own
// framework/hydration scripts when the page isn't statically generated),
// which would regress /login, /register, and the public /share page from
// static to server-rendered-per-request for no benefit proportionate to
// this hardening pass. 'unsafe-inline' on script-src and style-src is a
// deliberate, documented compromise instead — style-src also needs it
// because next/font injects an inline @font-face <style> tag for the
// self-hosted Geist fonts used in app/layout.tsx.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Ignored by browsers over plain HTTP (dev) — only takes effect once the
  // app is actually served over HTTPS in production.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
