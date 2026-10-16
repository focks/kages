"use client";

// The saved critique of a Kage: the latest report, the score table, the backlog you
// can work through, the trend and how the review was done. Reads and writes are
// operations over REST; scoring happens elsewhere (an agent does it), so this only
// displays, toggles backlog status and closes.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { op, relTime } from "@/components/dashboard/kage-ui";
import { SEV_LABEL, banners, scoreRows, sortedBacklog, type CritiqueView } from "./critique-model";

interface Listing { critiques: CritiqueView[]; trend: { line: string } }
const overline = "font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

export function CritiqueTab({ name, canWrite = true, onChanged }: { name: string; canWrite?: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<Listing | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await op<Listing>("list_critiques", { kage: name })); } catch { setData(null); } }, [name]);
  useEffect(() => { setData(undefined); void load(); }, [load]);

  if (data === undefined) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (data === null) return <p className="text-sm text-muted-foreground">You can't read this Kage's critiques.</p>;
  const latest = data.critiques[0];
  if (!latest) return (
    <div className="max-w-md space-y-2">
      <h3 className="font-display text-base font-[650]">No critique yet</h3>
      <p className="text-sm text-muted-foreground">Ask an agent to review it: <span className="font-mono">kages critique {name}</span> gives it the evidence and the rubric, and it saves the result here.</p>
    </div>
  );

  const act = async (fn: () => Promise<unknown>, done: string) => { setBusy(true); try { await fn(); toast.success(done); await load(); onChanged?.(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const rows = scoreRows(latest);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-display text-[28px] leading-8 font-[650] tracking-[-0.01em] tabular-nums">{latest.total}<span className="text-muted-foreground">/{latest.max}</span></span>
        <span className="font-mono text-xs text-muted-foreground">{latest.id} · v{latest.version} · {relTime(latest.createdAt)} · {latest.author}</span>
        <span className="ml-auto" />
        {canWrite && latest.state === "open" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => op("close_critique", { id: latest.id, reason: "backlog cleared" }), "Critique closed")}>Close</Button>}
      </div>
      <p className="text-sm text-muted-foreground">{data.trend.line}</p>

      {banners(latest).map((b, i) => (
        <div key={i} role={b.tone === "warn" ? "alert" : undefined} className={cn("rounded-md border p-3 text-sm", b.tone === "warn" ? "border-warning/50 bg-warning-soft" : "bg-muted")}>{b.text}</div>
      ))}

      <section aria-label="Backlog" className="space-y-2">
        <h3 className={overline}>Backlog</h3>
        {latest.priorities.length === 0 && <p className="text-sm text-muted-foreground">No issues were recorded.</p>}
        <ul className="space-y-2">
          {sortedBacklog(latest.priorities).map(({ item, index }) => (
            <li key={index} className={cn("rounded-md border p-3 text-sm", item.status !== "open" && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border px-1.5 font-mono text-[11px]" title={SEV_LABEL[item.sev]}>{item.sev}</span>
                <span className="font-medium">{item.title}</span>
                {item.block && <span className="font-mono text-xs text-muted-foreground">{item.block}</span>}
                <span className="ml-auto" />
                {canWrite && (
                  <select aria-label={`Status of ${item.title}`} value={item.status} disabled={busy} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                    onChange={(e) => void act(() => op("set_critique_priority", { id: latest.id, index, status: e.target.value }), "Updated")}>
                    <option value="open">open</option><option value="fixed">fixed</option><option value="wontfix">won't fix</option>
                  </select>
                )}
              </div>
              {item.why && <p className="mt-1 text-muted-foreground">{item.why}</p>}
              <p className="mt-1"><span className="text-muted-foreground">Fix: </span>{item.fix}{item.command && <span className="ml-2 font-mono text-xs text-muted-foreground">kages improve {item.command}</span>}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Scores" className="space-y-2">
        <h3 className={overline}>Scores</h3>
        <table className="w-full max-w-xl text-sm">
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">{r.id}</td>
              <td className="py-1.5 pr-3">{r.name}</td>
              <td className="py-1.5 text-right font-mono tabular-nums">{r.score === null ? <span title={r.reason} className="text-muted-foreground">n/a</span> : r.score}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      {latest.body && (
        <section aria-label="Report" className="space-y-2">
          <h3 className={overline}>Report</h3>
          {/* Untrusted text: shown as plain text, never as markup. */}
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border bg-muted p-4 font-sans text-[13px] leading-5">{latest.body}</pre>
        </section>
      )}
      {data.critiques.length > 1 && <p className="text-xs text-muted-foreground">{data.critiques.length - 1} earlier critique(s): <span className="font-mono">kages critiques {name}</span></p>}
    </div>
  );
}
