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
    // Hashed files never change under their name (a new build gets a new folder or file), so browsers may keep
    // them for a year without asking again: a repeat view of any artifact skips the network for ~600 KB of
    // script and style. The unhashed aliases (/ds/bundle.js, /runtime/frame.json) keep the default revalidation.
    const forever = { key: "Cache-Control", value: "public, max-age=31536000, immutable" };
    const hashed = [{ source: "/ds/versions/:hash([A-Za-z0-9_-]+)/:file", headers: [forever] }, { source: "/runtime/:file([A-Za-z0-9_-]{16,}\\.js)", headers: [forever] }];
    // Tell clients that fetch a share page that a text version exists (RFC 8288 alternate link).
    const share = { source: "/k/:id([A-Za-z0-9-]+)", headers: [{ key: "Link", value: "</k/:id.md>; rel=\"alternate\"; type=\"text/markdown\"" }, { key: "Vary", value: "Accept" }] };
    const project = { source: "/r/:id([A-Za-z0-9-]+)", headers: [{ key: "Link", value: "</r/:id.md>; rel=\"alternate\"; type=\"text/markdown\"" }, { key: "Vary", value: "Accept" }] };
    return [baseline, ...assets, ...hashed, share, project];
  },
  // A share link answers agents in markdown: /k/<uuid>.md, or /k/<uuid> when the client asks for text/markdown.
  async rewrites() {
    return { beforeFiles: [
      { source: "/k/:id([A-Za-z0-9-]+).md", destination: "/api/shared/:id/md" },
      { source: "/k/:id([A-Za-z0-9-]+)", has: [{ type: "header" as const, key: "accept", value: ".*text/markdown.*" }], destination: "/api/shared/:id/md" },
      { source: "/r/:id([A-Za-z0-9-]+).md", destination: "/api/shared-repo/:id/md" },
      { source: "/r/:id([A-Za-z0-9-]+)", has: [{ type: "header" as const, key: "accept", value: ".*text/markdown.*" }], destination: "/api/shared-repo/:id/md" },
    ], afterFiles: [], fallback: [] };
  },
  // The library has been called "Kages" and "Artifacts" in turn; both old paths
  // keep working (and keep any ?id= deep link) rather than 404.
  async redirects() {
    return [
      { source: "/kages", destination: "/artifacts", permanent: false },
      { source: "/library", destination: "/artifacts", permanent: false },
      // The Studio editor is gone; its old links land in the Library, where New Kage lives.
      { source: "/studio", destination: "/artifacts", permanent: false },
    ];
  },
};

export default nextConfig;
