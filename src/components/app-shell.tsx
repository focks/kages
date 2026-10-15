"use client";

// The dashboard chrome wrapped around every page: the left sidebar, a sticky
// header with the collapse trigger + current-page title + theme toggle, and the
// scrollable content region. A client component because the sidebar and theme
// toggle are interactive; it renders the server children untouched.

import { usePathname } from "next/navigation";
import { LucideProvider } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";

const TITLES: Record<string, string> = {
  "/": "Dashboard", "/artifacts": "Library", "/studio": "Studio", "/settings": "Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? (pathname.startsWith("/artifacts") ? "Library" : "Kages");
  return (
    <LucideProvider strokeWidth={1.5}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <h1 className="text-sm font-medium">{title}</h1>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </LucideProvider>
  );
}
