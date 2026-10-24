// Share links carry only author-selected scalar controls. Imported rows, host
// results and personal/shared persistence never become accidental URL contents.
import type { KageDoc, Json } from '../engine/types.ts';
const marker = '~view=';
const scalar = (value: unknown): value is string | number | boolean | null => value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && value.length <= 120;

/** Only existing top-level state keys explicitly declared as shareable qualify. */
export function shareKeys(doc: KageDoc): string[] {
  const keys = doc.meta && typeof doc.meta === 'object' && !Array.isArray(doc.meta) ? doc.meta.shareState : undefined;
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((key): key is string => typeof key === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(key) && !['constructor', 'prototype', '__proto__'].includes(key) && Object.hasOwn(doc.state ?? {}, key) && !Object.keys(doc.persist ?? {}).some(path => path === key || path.startsWith(key + '.')) && scalar(doc.state?.[key])))].slice(0, 12);
}

/** Invalid or oversized links are ignored; values cannot change the declared type. */
export function sharedView(doc: KageDoc, hash: string): Record<string, Json> {
  const result: Record<string, Json> = {};
  const encoded = hash.split(marker)[1];
  if (!encoded || encoded.length > 4000) return result;
  try {
    const data = JSON.parse(decodeURIComponent(encoded));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return result;
    for (const key of shareKeys(doc)) if (Object.hasOwn(data, key) && scalar(data[key]) && typeof data[key] === typeof doc.state?.[key]) result[key] = data[key];
  } catch { /* A malformed fragment must not prevent the published artifact loading. */ }
  return result;
}

/** Preserve the chapter while replacing an older view; no data is sent in a query. */
export function viewHash(doc: KageDoc, state: Record<string, Json>, hash: string): string {
  const values: Record<string, Json> = {};
  for (const key of shareKeys(doc)) if (Object.hasOwn(state, key) && scalar(state[key]) && typeof state[key] === typeof doc.state?.[key]) {
    values[key] = state[key];
    if (encodeURIComponent(JSON.stringify(values)).length > 4000) delete values[key];
  }
  const chapter = hash.split(marker)[0];
  return chapter + (Object.keys(values).length ? (chapter ? '' : '#') + marker + encodeURIComponent(JSON.stringify(values)) : '');
}

/** A session starting view never mutates the signed published document. */
export function docWithSharedView(doc: KageDoc, hash: string): KageDoc {
  const values = sharedView(doc, hash);
  return Object.keys(values).length ? { ...doc, state: { ...doc.state, ...values } } : doc;
}
