// A subtle "Made with Kages" attribution, shown at the bottom of a rendered
// Kage on the consumer surfaces (the /k share page and the fullscreen preview).
// Chrome-token styled so it sits in the app frame, not inside the Kage's own
// design-system scope.

import { Hexagon } from "lucide-react";

export function MadeWithKages({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={`inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-pop backdrop-blur transition-colors hover:text-foreground ${className ?? ""}`}
    >
      <Hexagon className="size-3.5" aria-hidden />
      Made with <span className="font-medium text-foreground">Kages</span>
    </a>
  );
}
