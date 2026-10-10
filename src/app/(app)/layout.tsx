import { AppShell } from "@/components/app-shell";

// The dashboard chrome lives here, not in the root layout: every route in this
// (app) group renders inside the persistent sidebar + header. Routes OUTSIDE the
// group — notably /k/<name>, the shareable published-Kage link — skip the shell
// and render the Kage on a bare page, which is what someone following a share
// link should see (no workbench around content they may not have access to).
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
