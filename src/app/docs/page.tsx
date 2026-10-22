import Link from "next/link";

// The docs: one page, how to install, nothing else. A plain static page (no
// Kage renderer, no generated nav) — the product is the app, not the manual.

export const metadata = {
  title: "Install · Kages",
  description: "How to install and run Kages.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-foreground/[0.04] p-4 font-mono text-[13px] leading-relaxed">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Link href="/docs" className="font-display text-[15px] font-[650] tracking-[-0.01em]">Kages docs</Link>
        <Link href="/artifacts" className="ml-auto text-sm text-muted-foreground hover:text-foreground">Open the app</Link>
      </header>

      <article className="mx-auto w-full max-w-2xl px-6 py-14">
        <h1 className="font-display text-[32px] font-[680] tracking-[-0.02em]">Install Kages</h1>
        <p className="mt-4 text-muted-foreground">
          The quickest way to run Kages is with <code className="font-mono text-[0.9em]">npx</code> — no install,
          no checkout (Node 18 or newer):
        </p>
        <div className="mt-5"><Code>npx kages --version</Code></div>

        <p className="mt-8 text-muted-foreground">
          To work on Kages itself, run it from a checkout instead (Node 22.18 or newer):
        </p>
        <div className="mt-5">
          <Code>{`git clone https://github.com/focks/kages && cd kages
npm install
npm run build:cli          # writes dist/kages.mjs, runs on Node 18+
alias kages="node $PWD/dist/kages.mjs"
kages --version`}</Code>
        </div>

        <p className="mt-8 text-muted-foreground">
          Then, in the project where you work, <code className="font-mono text-[0.9em]">kages install</code> shows
          the files it would write for the coding tools it finds (Claude Code, Cursor, Codex, Copilot) and writes
          nothing until you agree:
        </p>
        <div className="mt-5"><Code>kages install</Code></div>

        <p className="mt-10 text-sm text-muted-foreground">
          Source and issues on <a href="https://github.com/focks/kages" target="_blank" rel="noreferrer" className="text-wire underline underline-offset-4 hover:text-foreground">GitHub</a>.
        </p>
      </article>
    </main>
  );
}
