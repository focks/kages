import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatePlugins, validateTarget, DEFAULT_MCP_URL } from "./generate.ts";
import { VERSION } from "../version.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(root + "package.json", "utf8")) as { version: string };

test("the committed plugin files equal the generator output, and there is nothing stale in a generated directory", () => {
  const { files, targets } = generatePlugins();
  for (const [p, c] of Object.entries(files)) assert.equal(existsSync(root + p) ? readFileSync(root + p, "utf8") : null, c, `${p}: run npm run build:plugins`);
  for (const t of targets) {
    const found = execFileSync("find", [root + t.dir, "-type", "f"], { encoding: "utf8" }).split("\n").filter(Boolean).map((f) => f.slice(root.length));
    assert.deepEqual(found.filter((f) => !(f in files)), [], `stale files in ${t.dir}`);
  }
});

test("every generated target passes the structural validator; a corrupted one does not", () => {
  const { targets } = generatePlugins();
  for (const t of targets) assert.deepEqual(validateTarget(t), [], t.id);
  const bad = structuredClone(targets[0]);
  bad.files[".claude-plugin/plugin.json"] = bad.files[".claude-plugin/plugin.json"].replace('"name": "kages"', '"name": "Claude Kages"');
  bad.files["skills/kages-core/SKILL.md"] = "no frontmatter";
  bad.files["agents/kages-critic.md"] = "no frontmatter either";
  bad.files["hooks/hooks.json"] = bad.files["hooks/hooks.json"].replace("bin/kages-hook", "bin/missing-hook");
  bad.files["bin/leak.sh"] = "token=Bearer abcdefghijklmnopqrstuvwxyz0123456789 /home/me/secret";
  bad.files["broken.json"] = "{";
  const msgs = validateTarget(bad).join("\n");
  for (const re of [/name must be kebab-case/, /Anthropic/, /frontmatter must start with name and description/, /needs frontmatter with a description/, /bin\/missing-hook/, /credential/, /machine path/, /broken\.json is not valid JSON/]) assert.match(msgs, re);
  const missing = structuredClone(targets[1]);
  delete missing.files[".cursor-plugin/plugin.json"];
  assert.match(validateTarget(missing).join("\n"), /missing \.cursor-plugin\/plugin\.json/);
});

test("one version everywhere: package.json, both manifests, the marketplace entry, the CLI and the READMEs", () => {
  assert.equal(VERSION, pkg.version);
  const { files } = generatePlugins();
  assert.equal(JSON.parse(files["plugins/kages/.claude-plugin/plugin.json"]).version, pkg.version);
  assert.equal(JSON.parse(files["plugins/kages-cursor/.cursor-plugin/plugin.json"]).version, pkg.version);
  assert.equal(JSON.parse(files[".claude-plugin/marketplace.json"]).plugins[0].version, pkg.version);
  assert.match(files["plugins/kages/README.md"], new RegExp(`version ${pkg.version.replace(/\./g, "\\.")}`));
  const bumped = generatePlugins({ version: "9.9.9" }).files;
  const changed = Object.keys(bumped).filter((p) => bumped[p] !== files[p]).sort();
  assert.deepEqual(changed, [".claude-plugin/marketplace.json", "plugins/README.md", "plugins/kages-cursor/.cursor-plugin/plugin.json", "plugins/kages-cursor/README.md", "plugins/kages/.claude-plugin/plugin.json", "plugins/kages/README.md"], "a version bump touches exactly the version-bearing files");
});

test("the MCP URL: only the configured one appears; a private build changes all and only those", () => {
  const { files } = generatePlugins();
  const urls = (fs: Record<string, string>) => Object.entries(fs).filter(([, c]) => /https:\/\/[^\s"'`)]+\/api\/mcp/.test(c)).map(([p]) => p).sort();
  for (const [p, c] of Object.entries(files)) for (const m of c.matchAll(/https?:\/\/[^\s"'`)]+\/api\/mcp/g)) assert.equal(m[0], DEFAULT_MCP_URL, p);
  const priv = generatePlugins({ mcpUrl: "https://kages.example.test/api/mcp" }).files;
  assert.deepEqual(urls(priv), urls(files));
  for (const [p, c] of Object.entries(priv)) if (/https:\/\/[^\s"'`)]+\/api\/mcp/.test(c)) { assert.ok(c.includes("kages.example.test"), p); assert.ok(!c.includes(DEFAULT_MCP_URL), p); }
});

test("nothing machine-specific or secret in any generated file; no absolute paths", () => {
  for (const [p, c] of Object.entries(generatePlugins().files)) {
    assert.doesNotMatch(c, /\/home\/|\/Users\/|localhost|127\.0\.0\.1/, p);
    assert.doesNotMatch(p, /^\/|\.\./, p);
  }
});

test("every file a manifest or hook refers to exists in the plugin, and the launcher is executable on disk", () => {
  const { files } = generatePlugins();
  for (const dir of ["plugins/kages", "plugins/kages-cursor"]) {
    assert.ok(`${dir}/bin/kages-hook` in files);
    assert.equal(statSync(root + `${dir}/bin/kages-hook`).mode & 0o111, 0o111, "the launcher must be executable");
    for (const m of files[`${dir}/hooks/hooks.json`].matchAll(/bin\/[a-z-]+/g)) assert.ok(`${dir}/${m[0]}` in files, m[0]);
  }
  const mcp = JSON.parse(files["plugins/kages-cursor/mcp.json"]);
  assert.equal(mcp.mcpServers.kages.url, DEFAULT_MCP_URL);
  const hooks = JSON.parse(files["plugins/kages/hooks/hooks.json"]).hooks;
  assert.deepEqual(Object.keys(hooks).sort(), ["PostToolUse", "PreToolUse", "Stop"]);
  assert.match(hooks.PostToolUse[0].hooks[0].command, /^"\$\{CLAUDE_PLUGIN_ROOT\}"\/bin\/kages-hook --harness claude --event post$/);
});

test("the planned targets are named, not generated", () => {
  const g = generatePlugins();
  assert.deepEqual(g.planned, ["vscode", "codex", "grok"]);
  assert.deepEqual(g.targets.map((t) => t.id), ["claude", "cursor"]);
  assert.match(g.files["plugins/README.md"], /Planned, not generated:\*\* VS Code/);
});

// The harness's own validator is the authority when it is installed.
const hasClaude = (() => { try { execFileSync("claude", ["--version"], { stdio: "ignore", timeout: 15_000 }); return true; } catch { return false; } })();
test("claude plugin validate accepts the plugin and the marketplace", { skip: !hasClaude && "the claude CLI is not installed" }, () => {
  for (const target of [root + "plugins/kages", root]) {
    const out = execFileSync("claude", ["plugin", "validate", target, "--strict"], { encoding: "utf8", timeout: 60_000, cwd: root });
    assert.match(out, /Validation passed/, target);
  }
});
