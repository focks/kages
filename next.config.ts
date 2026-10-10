import type { NextConfig } from "next";

// A Kage previews inside the dashboard now (the fullscreen overlay replaced the
// standalone /viewer route), so the Kage runs in the dashboard's own document —
// a route-scoped CSP can no longer wrap just the untrusted content. The boundary
// that actually matters is production own-origin isolation: a published Kage
// renders on its own `<id>.kages-usercontent.app` origin with the strict spec
// CSP (default-src 'none', scripts self + registry, base-uri/form-action locked).
// That is deployment infrastructure, documented as not-yet-implemented in
// src/runtime/KageRenderer.tsx. See oracle/runtime-security.feature.
const nextConfig: NextConfig = {};

export default nextConfig;
