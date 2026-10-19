// The "Use this Kage" instructions shown under every Kage: how to install the CLI, fetch this
// exact Kage and wire it to an agent over MCP or REST. Pure, so the commands are tested rather
// than eyeballed — a wrong flag here is copy-pasted straight into someone's terminal.

export interface UsageStep { label: string; command: string; note?: string }
export interface UsageGroup { id: "install" | "cli" | "mcp" | "rest"; title: string; steps: UsageStep[] }

/** Keep only a real http(s) origin: it is interpolated into shell commands the reader will run. */
export function cleanOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : "";
  } catch { return ""; }
}

/** Names go into shell commands and file names, so reduce them to a safe slug. */
export function fileStem(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60) || "kage";
}

/** `uuid` is set for a shared link (fetchable by anyone with it); without it only the local-name routes apply. */
export function usageGroups(opts: { origin: string; name: string; uuid?: string }): UsageGroup[] {
  const origin = cleanOrigin(opts.origin) || "https://your-kages-host";
  const stem = fileStem(opts.name), file = `${stem}.kage.json`;
  const uuid = opts.uuid && /^[A-Za-z0-9_-]+$/.test(opts.uuid) ? opts.uuid : undefined;
  const target = uuid ? `uuid: "${uuid}"` : `name: "${opts.name.replace(/["\\]/g, "")}"`;

  const cli: UsageStep[] = [];
  if (uuid) cli.push({ label: "Download this Kage", command: `curl -fsSL ${origin}/api/shared/${uuid} -o ${file}` });
  else cli.push({ label: "Print this Kage", command: `npx kages get ${stem} -o ${file}`, note: "From the workspace that holds it." });
  cli.push(
    { label: "Check it", command: `npx kages validate ${file} && npx kages lint ${file}` },
    { label: "Read it as text", command: `npx kages describe ${file}` },
    { label: "Render a screenshot", command: `npx kages screenshot ${file} --width 390,1200`, note: "Needs Chrome on this machine." },
    { label: "Send it to a running app", command: `npx kages push ${file} --server ${origin}`, note: "Add --token or run `kages auth login` for a hosted workspace." },
  );

  return [
    { id: "install", title: "Install the CLI", steps: [
      { label: "Run without installing", command: "npx kages --version", note: "Node 18 or newer." },
      { label: "Add the authoring skills to your coding tools", command: "npx kages install", note: "Shows what it would write and asks first; add --dry-run to only look." },
    ] },
    { id: "cli", title: "Use it from the CLI", steps: cli },
    { id: "mcp", title: "Connect an agent over MCP", steps: [
      { label: "Claude Code (local server)", command: "claude mcp add kages -- npx kages mcp" },
      { label: "Codex (local server)", command: "codex mcp add kages -- npx kages mcp" },
      { label: "Claude Code (remote server)", command: `claude mcp add --transport http kages ${origin}/api/mcp`, note: "Anonymous callers are read-only; add --header \"Authorization: Bearer $KAGES_TOKEN\" to write." },
      { label: "Then ask the agent to call", command: `get_kage { ${target} }`, note: "Start any session with get_context." },
    ] },
    { id: "rest", title: "Use it over REST", steps: [
      ...(uuid ? [{ label: "Fetch the document", command: `curl -s ${origin}/api/shared/${uuid}` }] : []),
      { label: "Call any operation", command: `curl -s ${origin}/api/get_kage -H "Authorization: Bearer $KAGES_TOKEN" -H "content-type: application/json" -d '{"${uuid ? "uuid" : "name"}":"${uuid ?? opts.name.replace(/["\\']/g, "")}"}'`, note: "Every operation is POST /api/<op>; see the OpenAPI document at /api/openapi.json." },
    ] },
  ];
}
