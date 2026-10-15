"use client";

// One Kage in the library, as a grid tile or a list row. Both share the same
// interaction model: the title is a real button whose ::after stretches over the
// whole card (so the card is one big target and one tab stop), while pin and
// preview sit above it as their own buttons. A card is never a div with onClick.

import { Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StateBadge, SystemChip, ValidationStatus, relTime, type KageCard } from "@/components/dashboard/kage-ui";

interface TileProps {
  card: KageCard;
  selected: boolean;
  pinned: boolean;
  onOpen: (name: string) => void;
  onPin: (name: string) => void;
  onPreview: (card: KageCard) => void;
}

const ring = "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

function PinButton({ card, pinned, onPin, className }: { card: KageCard; pinned: boolean; onPin: (name: string) => void; className?: string }) {
  return (
    <Button size="icon-sm" variant="ghost" aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} ${card.title}`} title={pinned ? "Unpin" : "Pin to the top of your library"}
      onClick={() => onPin(card.name)} className={cn("relative z-10", className)}>
      <Star className={cn(pinned && "fill-primary text-primary")} />
    </Button>
  );
}

function KindChips({ kinds }: { kinds: string[] }) {
  if (!kinds.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Block types">
      {kinds.map((k) => <li key={k} className="rounded-sm bg-muted px-1.5 font-mono text-[11px] leading-[18px] text-muted-foreground">{k}</li>)}
    </ul>
  );
}

export function KageTile({ card, selected, pinned, onOpen, onPin, onPreview }: TileProps) {
  return (
    <article data-kage-card={card.name} className={cn("group relative flex flex-col gap-2.5 rounded-xl border bg-card p-4 transition-colors hover:bg-accent", ring, selected && "border-primary bg-primary-soft hover:bg-primary-soft")}>
      <div className="flex items-center gap-2">
        <SystemChip system={card.system.split("@")[0]} />
        <span className="ml-auto"><StateBadge state={card.state} /></span>
        <PinButton card={card} pinned={pinned} onPin={onPin} className="-mr-1.5" />
      </div>
      <h3 className="font-medium leading-snug">
        <button type="button" data-open className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:content-['']" onClick={() => onOpen(card.name)} aria-label={`Open ${card.title}`}>{card.title}</button>
      </h3>
      <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">{card.description || <span className="italic">No description</span>}</p>
      <KindChips kinds={card.kinds} />
      <div className="mt-auto flex items-center gap-x-3 gap-y-1 border-t pt-2.5 text-xs text-muted-foreground flex-wrap">
        <span className="font-mono">{card.repo}</span>
        <span>{card.blocks} blocks</span>
        <span className="font-mono">v{card.version}</span>
        <ValidationStatus validation={card.validation} short />
        <span className="ml-auto">{relTime(card.createdAt)}</span>
      </div>
      <Button size="icon-sm" variant="outline" aria-label={`Preview ${card.title}`} onClick={() => onPreview(card)}
        className="absolute right-3 bottom-10 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><Eye /></Button>
    </article>
  );
}

export function KageRow({ card, selected, pinned, onOpen, onPin, onPreview }: TileProps) {
  return (
    <article data-kage-card={card.name} className={cn("group relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-accent @2xl:grid-cols-[auto_minmax(0,1fr)_auto_5.5rem_auto] @4xl:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_7rem_auto_5.5rem_auto]", ring, selected && "bg-primary-soft hover:bg-primary-soft")}>
      <PinButton card={card} pinned={pinned} onPin={onPin} />
      <div className="min-w-0">
        <h3 className="truncate font-medium leading-snug">
          <button type="button" data-open className="max-w-full truncate text-left outline-none after:absolute after:inset-0 after:content-['']" onClick={() => onOpen(card.name)} aria-label={`Open ${card.title}`}>{card.title}</button>
        </h3>
        <p className="truncate text-xs text-muted-foreground">{card.description || card.kinds.join(" · ") || "No description"}</p>
      </div>
      <span className="hidden truncate font-mono text-xs text-muted-foreground @4xl:block">{card.repo}</span>
      <span className="hidden @4xl:block"><SystemChip system={card.system.split("@")[0]} /></span>
      <span className="justify-self-start"><StateBadge state={card.state} /></span>
      <span className="hidden text-right text-xs text-muted-foreground @2xl:block">{relTime(card.createdAt)}</span>
      <Button size="icon-sm" variant="ghost" aria-label={`Preview ${card.title}`} onClick={() => onPreview(card)} className="relative z-10 justify-self-end"><Eye /></Button>
    </article>
  );
}
