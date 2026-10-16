import type { NextConfig } from "next";

// Opaque artifact frames fetch only immutable, integrity-pinned public assets.
const nextConfig: NextConfig = {
  distDir: process.env.KAGES_NEXT_DIST_DIR ?? ".next",
  async headers() {
    const assets = ["/ds/:path*", "/runtime/:path*"].map(source => ({ source, headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }));
    // Baseline hardening for every response. Artifacts run in srcdoc frames (never by URL), so refusing to
    // be framed by other sites costs nothing and stops click-jacking of the comment and sign-in surfaces.
    const baseline = { source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ] };
    return [baseline, ...assets];
  },
  // The docs route reads docs/*.md at build time; make sure they ship with it.
  outputFileTracingIncludes: { "/docs/[[...slug]]": ["./docs/**/*"] },
  // The library has been called "Kages" and "Artifacts" in turn; both old paths
  // keep working (and keep any ?id= deep link) rather than 404.
  async redirects() {
    return [
      { source: "/kages", destination: "/artifacts", permanent: false },
      { source: "/library", destination: "/artifacts", permanent: false },
    ];
  },
};

export default nextConfig;
