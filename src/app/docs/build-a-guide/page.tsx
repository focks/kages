// The interactive lesson in the docs: build a decision guide from an example. A static route, so it
// wins over the markdown catch-all. Its title and intro go through the same converter as every other
// docs page (so it reads as one of them); the builder sits below in a panel.
import { loadDocs } from "@/docs/load";
import { outlineToKage } from "@/engine/outline";
import { DocsView } from "../[[...slug]]/view";
import { docsNav, BUILD_GUIDE } from "@/docs/nav";
import { GuideBuilder } from "@/components/dashboard/guide/guide-builder";
import type { KageDoc } from "@/engine/types";

export const metadata = { title: `${BUILD_GUIDE.title} · Kages docs` };

const INTRO = `# ${BUILD_GUIDE.title}

Readers answer a question, change the numbers and follow the setup steps. Start from an example and make it yours; the [decision guides](/docs/decision-guides) page explains what goes into one.
`;

export default function BuildGuidePage() {
  const { pages, config } = loadDocs();
  const built = outlineToKage(INTRO, { title: BUILD_GUIDE.title, id: "docs-build-a-guide", system: config.system, toc: "auto" });
  const doc = { ...built.doc, brief: { mode: "read" } } as KageDoc;
  return <DocsView nav={docsNav(pages)} doc={doc} current={BUILD_GUIDE.slug} editHref={null}><GuideBuilder /></DocsView>;
}
