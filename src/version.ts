// The one version number. package.json is the source; the CLI, the plugin manifests and
// every installed file's frontmatter read it from here (or from the file at build time),
// so a release is a single edit and `kages check` can say what is stale.
import pkg from "../package.json" with { type: "json" };

export const VERSION: string = pkg.version;
