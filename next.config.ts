import type { NextConfig } from "next";

// The viewer runs a Kage as untrusted content, so it carries the strict CSP from
// the spec: no network except self + the registry for scripts, styles limited to
// self + Google Fonts, and base-uri/form-action locked down. In production a
// published Kage renders on its own usercontent origin; here we apply the policy
// at the route so the boundary is real even in the single-origin dev app. See
// oracle/runtime-security.feature.
// Next's dev server evaluates strings (React Refresh / webpack HMR), which the
// production policy correctly forbids — so 'unsafe-eval' is added in dev ONLY.
// A published Kage ships the strict policy with no eval; the boundary that
// matters is the production one.
const DEV = process.env.NODE_ENV !== "production";
const KAGE_CSP = [
  "default-src 'none'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""} https://registry.kages.app`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self'${DEV ? " ws:" : ""}`,
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/viewer",
        headers: [{ key: "Content-Security-Policy", value: KAGE_CSP }],
      },
    ];
  },
};

export default nextConfig;
