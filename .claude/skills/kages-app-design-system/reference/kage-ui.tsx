import { Archive, CircleCheck, CircleDashed, CircleX, Eye, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Lifecycle states. Each pairs a soft ground with its own text colour AND an
// icon, so a state never rests on hue alone (review and published are both
// cool tints; the eye and the check tell them apart for a colour-blind reader).
const STATE: Record<string, { cls: string; icon: LucideIcon }> = {
  draft: { cls: "border-dashed border-input bg-transparent text-muted-foreground", icon: CircleDashed },
  review: { cls: "border-transparent bg-wire-soft text-wire", icon: Eye },
  published: { cls: "border-transparent bg-success-soft text-success", icon: CircleCheck },
  deprecated: { cls: "border-transparent bg-warning-soft text-warning", icon: TriangleAlert },
  archived: { cls: "border-transparent bg-muted text-muted-foreground", icon: Archive },
};

export function StateBadge({ state }: { state: string }) {
  const s = STATE[state] ?? STATE.draft;
  return (
    <Badge variant="secondary" className={cn("pl-1.5 capitalize", s.cls)}>
      <s.icon aria-hidden />
      {state}
    </Badge>
  );
}

// A system is identified by its OWN accent, taken from that system's tokens
// (core accent, ledger-accent, atelier-accent), never by a colour the chrome
// invents. The foreground flips in dark because the accents lighten there.
const SYS_CLASS: Record<string, string> = {
  core: "bg-sys-core text-sys-core-foreground",
  ledger: "bg-sys-ledger text-sys-ledger-foreground",
  atelier: "bg-sys-atelier text-sys-atelier-foreground",
};

export function SystemChip({ system, className }: { system: string; className?: string }) {
  const id = system.split("@")[0];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[12.5px] leading-[18px] text-muted-foreground", className)}>
      <span className={cn("grid size-4 place-items-center rounded-sm text-[9px] font-semibold uppercase", SYS_CLASS[id] ?? "bg-muted text-muted-foreground")}>
        {id.slice(0, 2)}
      </span>
      {system}
    </span>
  );
}

// Validation always reads as icon + words. Warnings are their own tier: a Kage
// with 0 errors and 2 warnings is valid but not clean, and the list must say so.
export function ValidationStatus({ validation, short }: { validation: { ok: boolean; errors: number; warnings: number }; short?: boolean }) {
  const { errors, warnings } = validation;
  const tone = errors > 0 ? "text-destructive" : warnings > 0 ? "text-warning" : "text-success";
  const Icon = errors > 0 ? CircleX : warnings > 0 ? TriangleAlert : CircleCheck;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const text = short
    ? errors > 0 ? plural(errors, "error") : warnings > 0 ? plural(warnings, "warning") : "valid"
    : `${plural(errors, "error")}, ${plural(warnings, "warning")}`;
  return (
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      <Icon aria-hidden className={short ? "size-3.5" : "size-4"} />
      <span className={short ? undefined : "text-foreground"}>{text}</span>
    </span>
  );
}

// The boundary between chrome and content. The bar is ours (system, ref,
// digest); everything under it is painted by the Kage's own design system, so
// nothing below the bar may use a chrome token and the frame adds no padding.
export function KageFrame({ system, kageRef, digest, children }: { system: string; kageRef: string; digest?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex h-9 items-center gap-3 border-b bg-muted px-3">
        <SystemChip system={system} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{kageRef}</span>
        {digest && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <ShieldCheck aria-hidden className="size-3.5" />
            {digest.slice(0, 19)}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}
