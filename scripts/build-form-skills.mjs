// Packs the authoring-form skills from .claude/skills into src/packs/form-skills.json,
// because the single-file CLI cannot read this repo at runtime. A test fails when the
// two differ, so an edit to a skill cannot silently miss the agents outside this repo.
import { readFileSync, writeFileSync } from "node:fs";

const FORMS = { "report-kages": "kages-report", "answer-pages": "kages-answer-pages", "research-briefs": "kages-research-briefs", "graph-interaction-levels": "kages-graph-interaction-levels", "diagram-authoring": "kages-diagram-authoring", "visual-review": "kages-visual-review", "coherent-presentation": "kages-coherent-presentation", "field-guides": "kages-field-guides", "artifact-art-direction": "kages-artifact-art-direction" };

export function formSkills(root = ".") {
  return Object.entries(FORMS).map(([source, name]) => {
    const raw = readFileSync(`${root}/.claude/skills/${source}/SKILL.md`, "utf8");
    const [, front, body] = /^---\n([\s\S]*?)\n---\n+([\s\S]*)$/.exec(raw);
    const line = /^description:\s*(.*)$/m.exec(front)[1].trim();
    const description = line.startsWith('"') ? JSON.parse(line) : line;
    // Installed names carry the kages- prefix, so references between skills must too.
    const text = Object.entries(FORMS).reduce((t, [from, to]) => t.replace(new RegExp("`" + from + "`", "g"), "`" + to + "`"), body);
    // Shipped files must not name a machine; the plugin test enforces it.
    return { name, description, body: text.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g, "<your app url>").replace(/\blocalhost(:\d+)?/g, "your app") };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync("src/packs/form-skills.json", JSON.stringify(formSkills(), null, 1) + "\n");
}
