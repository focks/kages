// Gallery summaries are derived inside the workspace snapshot commit. Keeping
// them with membership and votes prevents an asynchronous index from exposing a
// Kage after its owner makes it private. No document or voter identity is public.
import type { VersionRecord, Provenance } from './types.ts';

export interface GallerySummary {
  uuid: string; title: string; description: string; system: string;
  kinds: string[]; version: number; publishedAt: string;
}
export interface GalleryRecord {
  uuid: string; name: string; listed: boolean; publishedAt: string;
  votes: Record<string, true>;
}
export interface GallerySnapshot extends GalleryRecord { card: GallerySummary | null }
export interface GalleryCard extends GallerySummary { upvotes: number; myVote: boolean }
export interface GalleryPage { items: GalleryCard[]; total: number; nextOffset: number | null; canVote: boolean }
export const canVoteGallery = (author: Provenance) => author.principal !== 'anon' && !author.principal.startsWith('guest:');
const voter = (author: Provenance) => author.onBehalfOf ?? author.principal;
const plain = (s: unknown, length: number) => typeof s === 'string' ? s.replace(/[#*_`>]+/g, '').replace(/\s+/g, ' ').trim().slice(0, length) : '';

/** Called from snapshot(), after every mutation, so private/draft/deleted heads
 * cannot leave an active summary behind. Old snapshots have no gallery entries. */
export function projectGallery(record: GalleryRecord, head?: VersionRecord): GallerySnapshot {
  let card: GallerySummary | null = null;
  if (record.listed && head?.uuid === record.uuid && head.state === 'published' && head.visibility === 'public') {
    const doc = head.doc, blocks = Object.values(doc.blocks), root = doc.blocks[doc.root];
    const description = plain(root?.props?.description ?? blocks.find(b => b.props?.description)?.props?.description ?? blocks.find(b => b.type === 'text' || b.type === 'markdown')?.props?.text, 180);
    const structure = new Set(['page','canvas','section','stack','grid','split','card','text','button','divider','anchor','toc']);
    card = { uuid: head.uuid, title: plain(doc.title || doc.id, 160), description, system: head.resolved.system, kinds: [...new Set(blocks.map(b => b.type).filter(t => !structure.has(t)))].slice(0, 4), version: head.v, publishedAt: record.publishedAt };
  }
  return { ...record, votes: { ...record.votes }, card };
}

/** Only aggregate counts and the caller's own vote leave the server. */
export function galleryCard(entry: GallerySnapshot, author: Provenance): GalleryCard | null {
  return entry.listed && entry.card ? { ...entry.card, upvotes: Object.keys(entry.votes).length, myVote: canVoteGallery(author) && Object.hasOwn(entry.votes, voter(author)) } : null;
}

/** Stable ranking keeps pagination deterministic when scores and dates tie. */
export function galleryPage(entries: GallerySnapshot[], author: Provenance, options: { text?: string; sort?: string; offset?: number; limit?: number } = {}): GalleryPage {
  const query = (options.text ?? '').trim().toLowerCase();
  const items = entries.flatMap(e => { const card = galleryCard(e, author); return card ? [card] : []; })
    .filter(c => !query || `${c.title} ${c.description} ${c.kinds.join(' ')}`.toLowerCase().includes(query))
    .sort((a, b) => (options.sort === 'newest' ? 0 : b.upvotes - a.upvotes) || b.publishedAt.localeCompare(a.publishedAt) || a.uuid.localeCompare(b.uuid));
  const offset = options.offset ?? 0, limit = options.limit ?? 12;
  return { items: items.slice(offset, offset + limit), total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null, canVote: canVoteGallery(author) };
}
export const galleryVoter = voter;
