// Clipboard export is a reading format, not describe()'s diagnostic tree.
// Only reachable content enters the output; arbitrary state, bindings, comments
// and agent setup instructions must never leak into a copied document.
import { KageSession } from '../engine/session.ts';
import { resolve } from '../engine/resolve.ts';
import type { KageDoc, Json } from '../engine/types.ts';

type Props = Record<string, any>;
const value = (v: unknown): string => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const text = (v: unknown) => value(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_[\]#|]/g, '\\$&');
const list = (items: unknown): any[] => Array.isArray(items) ? items : [];
// Passive links only. Parentheses are encoded so a source URL cannot terminate
// its Markdown destination and introduce another link or image.
const url = (v: unknown): string | null => typeof v === 'string' && /^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(v) && !/[\s<>\\]/.test(v) ? v.replace(/\(/g, '%28').replace(/\)/g, '%29') : null;
const link = (label: unknown, href: unknown) => url(href) ? `[${text(label)}](${url(href)})` : text(label);
function fence(source: string, min: number): string {
  return '`'.repeat((source.match(/`+/g) ?? []).reduce((n, run) => Math.max(n, run.length + 1), min));
}
function code(v: unknown, language?: unknown): string {
  const source = value(v), marker = fence(source, 3);
  return `${marker}${typeof language === 'string' ? language.replace(/[^\w+-]/g, '') : ''}\n${source}\n${marker}`;
}
function inlineCode(v: unknown): string {
  const source = value(v).replace(/\r?\n/g, ' '), marker = fence(source, 1);
  return `${marker} ${source} ${marker}`;
}
function formatted(v: unknown, format?: string): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return text(v);
  if (format === 'percent') return text(new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 12 }).format(v));
  if (format === 'currency') return text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 12 }).format(v));
  return text(v);
}
function table(rows: unknown[], supplied?: Props[]): string {
  if (!rows.length) return '_No data._';
  const records = rows.map(r => r && typeof r === 'object' && !Array.isArray(r) ? r as Props : { value: r });
  const columns: Props[] = supplied?.length ? supplied : [...new Set(records.flatMap(r => Object.keys(r)))].map(key => ({ key, label: key }));
  if (!columns.length) return '_No columns._';
  const cell = (v: unknown) => text(v).replace(/\r?\n/g, '<br>');
  return [
    '| ' + columns.map(c => cell(c.label ?? c.key)).join(' | ') + ' |',
    '| ' + columns.map(() => '---').join(' | ') + ' |',
    ...records.map(r => '| ' + columns.map(c => formatted(r[c.key], c.format).replace(/\r?\n/g, '<br>')).join(' | ') + ' |'),
  ].join('\n');
}
function rich(nodes: unknown): string {
  return list(nodes).map((n: Props) => {
    if (n.kind === 'code') return code(n.text, n.language);
    if (n.kind === 'list') return list(n.items).map((v, i) => (n.ordered ? `${i + 1}. ` : '- ') + text(v)).join('\n');
    const body = n.runs ? list(n.runs).map((r: Props) => {
      let s = r.code ? inlineCode(r.text) : text(r.text);
      if (r.bold) s = `**${s}**`;
      if (r.italic) s = `*${s}*`;
      if (url(r.href)) s = `[${s}](${url(r.href)})`;
      else if (r.cite) s = `[${s}]`;
      return s;
    }).join('') : text(n.text);
    if (n.kind === 'heading') return '#'.repeat(Math.min(6, Math.max(2, Number(n.level) || 2))) + ' ' + body;
    if (n.kind === 'quote') return body.split('\n').map(s => '> ' + s).join('\n') + (n.attribution ? '\n\n— ' + link(n.attribution, n.href) : '');
    return body;
  }).join('\n\n');
}

// Each chart family has a different data shape. Keeping axis/category labels
// alongside values prevents an attractive but meaningless matrix of numbers.
function chartData(role: string, p: Props): string {
  if (role === 'heatmap') {
    const columns = [{ key: 'row', label: 'Row' }, ...list(p.columns).map((label, i) => ({ key: `c${i}`, label }))];
    return table(list(p.rows).map((row, i) => ({ row, ...Object.fromEntries(list(p.values?.[i]).map((v, j) => [`c${j}`, v])) })), columns);
  }
  if (role === 'combo-chart' || role === 'stacked-bar-chart') {
    return table(list(p.categories).map((category, i) => ({ category, ...Object.fromEntries(list(p.series).map((s, j) => [`s${j}`, s.values?.[i]])) })),
      [{ key: 'category', label: p.xLabel || 'Category' }, ...list(p.series).map((s, j) => ({ key: `s${j}`, label: s.name }))]);
  }
  if (role === 'sankey') return table(list(p.nodes)) + '\n\n' + table(list(p.links));
  if (role === 'map') return table(list(p.features).map(({ id, name, value }) => ({ id, name, value })));
  if (role === 'small-multiples') return list(p.panels).map(panel => '### ' + text(panel.label) + '\n\n' + table(list(panel.items))).join('\n\n');
  if (role === 'gauge') return formatted(p.value) + (p.unit ? ' ' + text(p.unit) : '');
  return table(list(p.items ?? p.values ?? p.stages));
}

/** Export current app-state bindings without mutating the document. Local-only
 * controls (pagination, expanded panels) are not available outside the frame;
 * all rows and disclosure/tab content are exported, subject to block visibility.
 * Large exports fail explicitly rather than silently dropping rows or prose. */
export function kageMarkdown(doc: KageDoc, state?: Record<string, Json>): { markdown: string; notes: string[] } {
  const session = new KageSession({ ...doc, state: { ...doc.state, ...state } });
  const expanded = session.instances(), seen = new Set<string>(), notes = new Set<string>();
  const chunks: string[] = ['# ' + text(doc.title || doc.id)];
  let length = chunks[0].length;
  const add = (s: string) => {
    if (!s) return;
    length += s.length + 2;
    // A clipboard is not a streaming download; fail before assembling an
    // unbounded string, while leaving JSON download available to the reader.
    if (length > 2_000_000) throw Error('This Markdown exceeds the clipboard export limit. Download the Kage JSON or export a smaller view.');
    chunks.push(s);
  };
  const picture = (p: Props) => {
    if (url(p.src)) add(`![${text(p.alt || p.caption || 'Image')}](${url(p.src)})`);
    else notes.add('An image needs its original interactive page.');
    if (p.caption) add(text(p.caption));
  };
  function walk(id: string, depth: number) {
    if (seen.has(id)) return;
    seen.add(id);
    const b = expanded.blocks[id];
    if (!b || !session.visible(id)) return;
    const p = session.read(id) as Props | undefined;
    if (!p) return;
    const role = resolve(session.sysId, b.type).contract?.name ?? b.type;
    if (role === 'modal' && !p.open) return;
    const title = p.title ?? p.label;
    const heading = () => { if (title && title !== doc.title) add('#'.repeat(Math.min(6, Math.max(2, depth + 1))) + ' ' + text(title)); };
    const containers = ['shell', 'page', 'canvas', 'section', 'stack', 'grid', 'split', 'card', 'guide', 'disclosure', 'composition', 'form', 'modal', 'tab-panel'];
    if (containers.includes(role)) { heading(); if (p.description || p.subtitle) add(text(p.description ?? p.subtitle)); }
    else if (role === 'text') add((['display', 'title', 'heading'].includes(p.variant) ? '#'.repeat(Math.min(6, depth + 1)) + ' ' : '') + text(p.text));
    else if (role === 'markdown') add(value(p.text));
    else if (role === 'rich-text') add(rich(p.nodes));
    else if (role === 'code') { add(code(p.code, p.language)); if (p.caption) add(text(p.caption)); }
    else if (role === 'code-tabs') { for (const tab of list(p.tabs)) { add('### ' + text(tab.label)); add(code(tab.code, tab.language)); } if (p.caption) add(text(p.caption)); }
    else if (role === 'list') add(list(p.items).map((x, i) => (p.ordered ? `${i + 1}. ` : '- ') + text(x)).join('\n'));
    else if (role === 'link') add(link(p.label, p.href));
    else if (role === 'image') picture(p);
    else if (role === 'gallery' || role === 'carousel') {
      heading(); for (const item of list(p.items ?? p.slides)) { if (item.title) add('### ' + text(item.title)); if (item.text) add(text(item.text)); if (item.src) picture(item); }
    }
    else if (role === 'video' || role === 'audio') { heading(); add(link('Open ' + role, p.src)); if (p.caption) add(text(p.caption)); if (p.transcript) add(text(p.transcript)); }
    else if (role === 'math') add(p.display ? '$$\n' + value(p.tex) + '\n$$' : '$' + value(p.tex) + '$');
    else if (role === 'divider') add('---');
    else if (role === 'table' || role === 'data-grid') { heading(); add(table(list(p.rows), list(p.columns))); }
    else if (role === 'stat') { heading(); add(formatted(p.value, p.format)); if (p.delta != null) add('Change: ' + text(p.delta)); if (p.caption) add(text(p.caption)); }
    else if (role === 'diagram') {
      heading(); add(table(list(p.nodes), [{ key: 'id', label: 'ID' }, { key: 'label', label: 'Node' }]));
      if (list(p.edges).length) add(table(list(p.edges), [{ key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'label', label: 'Relationship' }]));
      if (p.caption) add(text(p.caption));
    }
    else if (/chart|treemap|sankey|heatmap|sparkline|box-plot/.test(role) || ['small-multiples', 'gauge', 'map'].includes(role)) {
      heading(); if (p.takeaway) add(text(p.takeaway)); if (p.unit) add('Unit: ' + text(p.unit));
      if (p.xLabel || p.yLabel) add([p.xLabel && 'X: ' + text(p.xLabel), p.yLabel && 'Y: ' + text(p.yLabel)].filter(Boolean).join('; '));
      if (p.status === 'loading' || p.status === 'error') add(text(p.statusMessage || (p.status === 'loading' ? 'Loading data.' : 'Data unavailable.')));
      else { if (p.status === 'stale') add('Data may be out of date.'); add(chartData(role, p)); }
      if (p.source) add('Source: ' + text(p.source)); if (p.updatedAt) add('Updated: ' + text(p.updatedAt));
    }
    else if (role === 'references') { heading(); add(list(p.items).map((r, i) => `${i + 1}. ${link(r.label, r.href)}${r.detail ? ' — ' + text(r.detail) : ''}`).join('\n')); }
    else if (role === 'glossary') { heading(); add(list(p.items).map(r => `**${text(r.term)}**: ${text(r.definition)}`).join('\n\n')); }
    else if (role === 'accordion') { heading(); for (const item of list(p.items)) { add('### ' + text(item.title)); add(text(item.body)); } }
    else if (role === 'alert') { heading(); add(text(p.text)); }
    else if (role === 'timeline' || role === 'stepper') { heading(); add(table(list(p.items ?? p.steps))); }
    else if (role === 'kanban') { heading(); for (const column of list(p.columns)) { add('### ' + text(column.title)); add(table(list(p.cards).filter(c => c.column === column.id))); } }
    else if (role === 'calendar') { heading(); add(text(p.month)); add(table(list(p.events))); }
    else if (role === 'checkbox' || role === 'switch') add(`- [${p.checked ? 'x' : ' '}] ${text(p.label)}`);
    else if (['choice', 'dropdown', 'combobox', 'slider', 'number-input'].includes(role)) { if (p.value != null) add(text(p.label) + ': ' + text(list(p.options).find(o => o.value === p.value)?.label ?? p.value)); }
    else if (role === 'badge') add(text(p.label));
    else if (role === 'source-status') { heading(); add(text(p.source)); add(text(p.message)); if (p.updatedAt) add('Updated: ' + text(p.updatedAt)); }
    else if (!['button', 'tabs', 'sidebar', 'toc', 'anchor', 'text-input', 'text-field', 'textarea', 'file-upload', 'csv-import', 'date-input', 'date-range', 'multiselect'].includes(role)) {
      heading(); if (p.text || p.caption || p.transcript) add(text(p.text ?? p.caption ?? p.transcript));
      notes.add(`The ${role} visual is available in the interactive Kage.`);
    }
    const slots = b.slots ?? {}, order = ['header', 'lead', 'main', 'start', 'children', 'end', 'actions', 'support', 'footer'];
    for (const slot of [...order, ...Object.keys(slots).filter(s => !order.includes(s))]) {
      if (role === 'tab-panel' && slots[slot]?.length) {
        const tab = list(p.tabs)[Number(slot.replace('panel', '')) - 1];
        if (tab) add('### ' + text(tab.label));
      }
      for (const child of slots[slot] ?? []) walk(child, containers.includes(role) && title ? depth + 1 : depth);
    }
  }
  walk(expanded.root, 1);
  return { markdown: chunks.join('\n\n') + '\n', notes: [...notes] };
}
