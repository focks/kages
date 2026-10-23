// Publish precisely the extended oracle used to extract contracts and capture
// goldens; hand-editing public assets would otherwise disappear on regeneration.
import { readFileSync, writeFileSync } from "node:fs";
import { presentationCss } from "../src/design-system/presentation.ts";
import { referenceBundle, referenceFile } from "./ds-source.mjs";

writeFileSync("public/ds/bundle.js", referenceBundle());
writeFileSync("public/ds/bundle.css", referenceFile("project/components/bundle.css") + "\n" + readFileSync("src/design-system/free-flow.css", "utf8") + "\n" + readFileSync("src/design-system/expressive.css", "utf8") + "\n" + readFileSync("src/design-system/rich.css", "utf8") + "\n" + readFileSync("src/design-system/apps.css", "utf8") + "\n" + readFileSync("src/design-system/charts.css", "utf8") + "\n" + readFileSync("src/design-system/content.css", "utf8") + "\n" + readFileSync("src/design-system/surfaces.css", "utf8") + "\n" + presentationCss() + "\n" + readFileSync("src/design-system/presentation.css", "utf8") + "\n" + readFileSync("src/design-system/motion.css", "utf8"));
