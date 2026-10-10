"use client";

// The "add block" catalog: the component types of the active design system,
// from the engine registry (not the store — contracts are static engine data,
// like the renderer already reads). Adding into a container's primary slot
// covers the common case; the slot picker appears only for multi-slot
// containers (e.g. shell → sidebar/header/main). Container types are marked so
// the author knows which can hold children.

import * as React from "react";
import { Plus, Box, Square } from "lucide-react";
import { systems, contracts } from "@/engine/data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

function typesOf(sysId: string): { role: string; container: boolean; summary: string }[] {
  const sys = systems[sysId];
  if (!sys) return [];
  return Object.entries(sys.components).map(([role, ref]) => {
    const c = contracts[ref as string];
    return { role, container: !!c && Object.keys(c.slots || {}).length > 0, summary: c?.summary ?? "" };
  });
}

export function AddBlockMenu({ sysId, slots, onAdd }: {
  sysId: string;
  slots: string[];                 // the selected container's declared slots
  onAdd: (type: string, slot: string) => void;
}) {
  const types = typesOf(sysId);
  const single = slots.length <= 1;
  const primary = slots.includes("children") ? "children" : slots[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={!primary} />}>
        <Plus className="size-4" /> Add block
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-auto">
        {types.map((t) =>
          single ? (
            <DropdownMenuItem key={t.role} onClick={() => onAdd(t.role, primary)}>
              {t.container ? <Box className="size-4" /> : <Square className="size-4" />}
              <span className="flex-1">{t.role}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub key={t.role}>
              <DropdownMenuSubTrigger>
                {t.container ? <Box className="size-4" /> : <Square className="size-4" />}
                <span className="flex-1">{t.role}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {slots.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onAdd(t.role, s)}>into <span className="font-mono">{s}</span></DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
