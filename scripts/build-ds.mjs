// Publish precisely the extended oracle used to extract contracts and capture
// goldens; hand-editing public assets would otherwise disappear on regeneration.
import { readFileSync, writeFileSync } from "node:fs";
import { referenceBundle } from "./ds-source.mjs";

writeFileSync("public/ds/bundle.js", referenceBundle());
writeFileSync("public/ds/bundle.css", readFileSync("originals/project/components/bundle.css", "utf8") + "\n" + readFileSync("src/design-system/free-flow.css", "utf8") + "\n" + readFileSync("src/design-system/expressive.css", "utf8"));
