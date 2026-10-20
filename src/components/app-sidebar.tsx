"use client";

// The persistent left navigation. Every route renders inside this shell, so the
// app reads as one dashboard rather than a set of pages. Active state follows
// the current path. Kept data-driven (one NAV array) so adding a destination is
// a one-line change.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Layers, Code2, BookOpen, Palette } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { WorkspaceLabel } from "@/components/dashboard/workspace-label";

const NAV = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Library", href: "/artifacts", icon: Layers },
  { title: "Designs", href: "/designs", icon: Palette },
];

const RESOURCES = [
  { title: "Docs", href: "/docs", icon: BookOpen, external: true },
  { title: "API (OpenAPI)", href: "/api/openapi.json", icon: Code2, external: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div aria-hidden className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary font-display text-[15px] font-bold tracking-[-0.03em] text-sidebar-primary-foreground">Kg</div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-[650]">Kages</div>
            <WorkspaceLabel />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive(item.href)} tooltip={item.title} className="data-active:[&>svg]:text-sidebar-primary">
                    <item.icon /><span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {RESOURCES.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<a href={item.href} target="_blank" rel="noreferrer" />} tooltip={item.title} className="data-active:[&>svg]:text-sidebar-primary">
                    <item.icon /><span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
