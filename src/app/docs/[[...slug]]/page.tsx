// The documentation, served as Kages. Each docs/*.md is converted by the same outline
// converter agents use, so the docs exercise the product; the build gates in
// src/docs/docs.test.ts keep every page valid and lint-clean. Public and read-only.
import { notFound } from "next/navigation";
import { loadDocs } from "@/docs/load";
import { DocsView } from "./view";
import { docsNav } from "@/docs/nav";

export const dynamic = "force-static";

export function generateStaticParams() {
  const { pages } = loadDocs();
  return [{ slug: [] }, ...pages.map((p) => ({ slug: [p.slug] }))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const { pages } = loadDocs();
  const page = pages.find((p) => p.slug === slug?.[0]);
  return { title: page ? `${page.title} · Kages docs` : "Kages documentation" };
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  if (slug && slug.length > 1) notFound();
  const { pages, index, config, problems } = loadDocs();
  const page = slug?.[0] ? pages.find((p) => p.slug === slug[0]) : undefined;
  if (slug?.[0] && !page) notFound();
  // A broken docs build must not render a half-empty site: fail the page so it is noticed.
  if (problems.length) throw new Error(`docs build problems:\n${problems.join("\n")}`);
  return <DocsView nav={docsNav(pages)} doc={page ? page.doc : index} current={page?.slug ?? null} editHref={page ? config.editUrl + page.file : null} />;
}
