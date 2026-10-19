"use client";

// The home dashboard: an at-a-glance overview of the artifactory — totals,
// lifecycle and per-system breakdown, plus the most recent Kages. All from the
// one operation set over REST (list_kages); the dashboard is an adapter client.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, CheckCircle2, FileEdit, Boxes, ArrowRight, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge, SystemChip, relTime, op, type KageCard } from "@/components/dashboard/kage-ui";

export default function DashboardPage() {
  const [cards, setCards] = useState<KageCard[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { op<KageCard[]>("list_kages").then(setCards).catch((e) => setError(String(e.message))); }, []);

  const total = cards?.length ?? 0;
  const published = cards?.filter((c) => c.state === "published").length ?? 0;
  const drafts = cards?.filter((c) => c.state === "draft" || c.state === "review").length ?? 0;
  const systems = new Set(cards?.map((c) => c.system.split("@")[0])).size;
  const bySystem = ["core", "ledger", "atelier"].map((s) => ({ s, n: cards?.filter((c) => c.system.startsWith(s)).length ?? 0 }));
  const recent = [...(cards ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);

  const stats = [
    { label: "Total Kages", value: total, icon: Layers },
    { label: "Published", value: published, icon: CheckCircle2 },
    { label: "Drafts and review", value: drafts, icon: FileEdit },
    { label: "Design systems", value: systems, suffix: "of 3", icon: Boxes },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h2 className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">Overview</h2>
        <p className="text-sm text-muted-foreground">An artifactory for agents — build, version, and ship interactive Kages.</p>
      </div>

      {error && <Card className="border-destructive"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium tracking-[0.01em] text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {cards ? (
                <div className="font-display text-[28px] leading-8 font-[650] tracking-[-0.01em] tabular-nums">
                  {s.value}{s.suffix && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{s.suffix}</span>}
                </div>
              ) : <Skeleton className="h-8 w-16" />}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Kages</CardTitle>
              <CardDescription>Latest versions across the workspace</CardDescription>
            </div>
            <Button render={<Link href="/artifacts" />} nativeButton={false} variant="ghost" size="sm">View all <ArrowRight className="size-4" /></Button>
          </CardHeader>
          <CardContent>
            {!cards ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No Kages yet. Ask an agent to build one, or import JSON in the Library.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Title</TableHead><TableHead>System</TableHead><TableHead>State</TableHead><TableHead className="text-right">Updated</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((c) => (
                    <TableRow key={c.name} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={`/artifacts?id=${c.name}`} className="hover:underline">{c.title}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">v{c.version}</span>
                      </TableCell>
                      <TableCell><SystemChip system={c.system} /></TableCell>
                      <TableCell><StateBadge state={c.state} /></TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{relTime(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>By design system</CardTitle><CardDescription>The same Kage renders in any</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {bySystem.map(({ s, n }) => (
              <div key={s} className="flex items-center justify-between">
                <SystemChip system={`${s}`} />
                <span className="text-sm font-medium">{cards ? n : "—"}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button render={<Link href="/artifacts" />} nativeButton={false} size="sm" variant="outline" className="flex-1"><Eye className="size-4" /> Preview</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
