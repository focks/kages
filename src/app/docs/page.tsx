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
          Install the CLI from npm (Node 18 or newer). The command is <code className="font-mono text-[0.9em]">kages</code>:
        </p>
        <div className="mt-5"><Code>{`npm install -g @ifocksh/kages
kages --version`}</Code></div>
        <p className="mt-3 text-sm text-muted-foreground">
          Or run it without installing: <code className="font-mono text-[0.9em]">npx @ifocksh/kages --version</code>.
        </p>

        <h2 className="mt-10 font-display text-[22px] font-[650] tracking-[-0.01em]">Connect your agent</h2>
        <p className="mt-3 text-muted-foreground">
          Register the Kages MCP server so your agent can build and publish Kages (for Codex, use <code className="font-mono text-[0.9em]">codex mcp add</code>):
        </p>
        <div className="mt-5"><Code>claude mcp add kages -- kages mcp</Code></div>
        <p className="mt-3 text-muted-foreground">
          Or let <code className="font-mono text-[0.9em]">kages install</code> wire every coding tool it finds (Claude Code, Cursor, Codex, Copilot) — it shows each file first and writes nothing until you agree:
        </p>
        <div className="mt-5"><Code>kages install</Code></div>

        <p className="mt-10 text-sm text-muted-foreground">
          Building on Kages itself? See the <a href="https://github.com/focks/kages" target="_blank" rel="noreferrer" className="text-wire underline underline-offset-4 hover:text-foreground">source on GitHub</a>.
        </p>
      </article>
    </main>
  );
}
