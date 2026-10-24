"use client";
// The gallery is an ordinary operation client. Global discovery and voting stay
// behind the same REST/MCP operations; no workspace IDs or voter lists reach UI.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUp, Images, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { op, SystemChip } from '@/components/dashboard/kage-ui';
import { KageThumbnail } from '@/components/dashboard/library/kage-thumbnail';
import type { GalleryCard, GalleryPage } from '@/store/gallery';

export default function Gallery() {
  const [data, setData] = useState<GalleryPage | null>(null);
  const [sort, setSort] = useState('top'), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    op<GalleryPage>('list_gallery', { sort, text: search, offset, limit: 12 }).then(result => {
      if (cancelled) return;
      if (!result.items.length && offset > 0) { setOffset(0); return; }
      setData(result);
    }, e => { if (!cancelled) setError((e as Error).message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort, search, offset, revision]);

  async function vote(card: GalleryCard) {
    if (!data?.canVote) { location.assign('/login?next=%2Fgallery'); return; }
    setPending(previous => new Set(previous).add(card.uuid)); setError('');
    try {
      const updated = await op<GalleryCard>('vote_gallery_kage', { uuid: card.uuid, value: card.myVote ? 0 : 1 });
      setData(current => current && { ...current, items: current.items.map(item => item.uuid === updated.uuid ? updated : item) });
      setRevision(n => n + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setPending(previous => { const next = new Set(previous); next.delete(card.uuid); return next; }); }
  }

  return <main className="min-h-dvh bg-background text-foreground">
    <header className="border-b">
      <nav aria-label="Gallery navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4 sm:px-8">
        <Link href="/landing" className="flex items-center gap-2 font-medium"><span className="grid size-7 place-items-center rounded-md bg-foreground font-mono text-xs text-background" aria-hidden>Kg</span>Kages</Link>
        <span className="text-sm text-muted-foreground">Community gallery</span>
        <Button className="ml-auto" variant="outline" size="sm" render={<Link href="/artifacts" />} nativeButton={false}>My library <ArrowRight className="size-4" /></Button>
      </nav>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b pb-8">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Made with agents. Shared by people.</p>
          <h1 className="font-display text-[22px] font-[650] leading-7 tracking-[-0.01em]">Ideas you can explore.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Discover interactive guides, charts and tools. Open a Kage, try it out, and upvote the work you find useful.</p>
        </div>
        <Button render={<Link href="/artifacts" />} nativeButton={false}><Images className="size-4" /> Share your work</Button>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">To add yours, open a Kage in your Library and choose Share → Publish to gallery. Gallery Kages are public. {data && !data.canVote && <Link href="/login?next=%2Fgallery" className="text-wire underline">Sign in to upvote.</Link>}</p>
      <div className="my-7 flex flex-wrap items-end justify-between gap-4">
        <form className="flex w-full max-w-md items-end gap-2" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setOffset(0); }}>
          <label className="flex-1 text-xs text-muted-foreground">Search gallery<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Guides, charts, tools…" type="search" className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" /></label>
          <Button type="submit" variant="outline" aria-label="Search gallery"><Search className="size-4" /></Button>
        </form>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" role="status">{loading ? 'Loading gallery…' : data ? `${data.total} ${data.total === 1 ? 'Kage' : 'Kages'}` : ''}</span>
          <label className="text-xs text-muted-foreground">Sort <select value={sort} onChange={event => { setSort(event.target.value); setOffset(0); }} className="ml-2 h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground"><option value="top">Most upvoted</option><option value="newest">Newest</option></select></label>
        </div>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive bg-card p-4 text-sm"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setRevision(n => n + 1)}>Try again</Button></div>}
      {!loading && !error && data?.items.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center"><Images className="mx-auto mb-4 size-6 text-muted-foreground" /><h2 className="font-medium">{search ? 'No matching Kages' : 'The gallery starts with a shared idea.'}</h2><p className="mt-2 text-sm text-muted-foreground">{search ? 'Try a different search or clear your filters.' : 'Publish a Kage from your Library to make it the first one here.'}</p>{search && <Button variant="outline" className="mt-4" onClick={() => { setQuery(''); setSearch(''); setOffset(0); }}>Clear search</Button>}</div>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
        {data?.items.map(card => <article key={card.uuid} data-gallery-card={card.uuid} className="group relative flex min-w-0 flex-col rounded-xl border bg-card p-4 transition-colors hover:border-input has-[:focus-visible]:border-ring">
          <KageThumbnail key={card.uuid + ':' + card.version} uuid={card.uuid} version={card.version} gallery />
          <div className="mt-4 flex items-center justify-between gap-2"><SystemChip system={card.system.split('@')[0]} /><span className="font-mono text-xs text-muted-foreground">v{card.version}</span></div>
          <h2 className="mt-3 font-medium leading-snug"><Link href={`/k/${card.uuid}`} className="break-words after:absolute after:inset-0 after:content-['']">{card.title}</Link></h2>
          <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-muted-foreground">{card.description || 'Open this Kage to explore its content.'}</p>
          <ul className="mb-4 mt-3 flex flex-wrap gap-1" aria-label="Capabilities">{card.kinds.map(kind => <li key={kind} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{kind}</li>)}</ul>
          <div className="mt-auto flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">{new Date(card.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
            <Button variant="outline" size="sm" className={`relative z-10 tabular-nums ${card.myVote ? 'border-primary bg-primary-soft' : ''}`} disabled={pending.has(card.uuid)} aria-pressed={card.myVote} aria-label={`${card.myVote ? 'Remove upvote from' : data.canVote ? 'Upvote' : 'Sign in to upvote'} ${card.title}`} onClick={() => void vote(card)}><ArrowUp className="size-4" /><span>{card.upvotes}</span><span>{card.myVote ? 'Upvoted' : 'Upvote'}</span></Button>
          </div>
        </article>)}
      </div>
      {data && (offset > 0 || data.nextOffset !== null) && <nav aria-label="Gallery pages" className="mt-8 flex justify-between"><Button variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 12))}>Previous</Button><Button variant="outline" disabled={loading || data.nextOffset === null} onClick={() => setOffset(data.nextOffset!)}>Next</Button></nav>}
    </div>
  </main>;
}
