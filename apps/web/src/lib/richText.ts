// Lightweight parser for the subset of Markdown the planner assistant actually
// emits (headings, bullets with a bold lead-in, tip callouts). Output is a block
// tree that the UI renders as real components, so raw "###" / "**" markers never
// reach the user and nothing is injected as HTML.

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'code'; value: string };

export type RichBlock =
  | { kind: 'heading'; order?: string; title: string; sub?: string }
  | { kind: 'poi'; name: string; address?: string; note: InlineToken[] }
  | { kind: 'labeled'; label: string; note: InlineToken[] }
  | { kind: 'bullet'; note: InlineToken[] }
  | { kind: 'numbered'; order: string; note: InlineToken[] }
  | { kind: 'callout'; title: string; items: RichBlock[] }
  | { kind: 'para'; note: InlineToken[] };

const INLINE_RE = /\*\*([^*]+)\*\*|`([^`]+)`/g;
const HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const BULLET_RE = /^\s{0,6}[*+-]\s+(.+)$/;
const NUMBERED_RE = /^\s{0,6}(\d{1,2})[.)]\s+(.+)$/;
const LEAD_NUM_RE = /^(\d{1,2})[.)]\s*(.*)$/;
const BOLD_LEAD_RE = /^\*\*(.+?)\*\*:?\s*(.*)$/;
const PARENS_RE = /^(.*?)\s*\(([^()]{2,})\)\s*$/;
const TIP_RE = /💡|lưu ý|luu y|ghi chú|note|tips?\b|mẹo/i;

// Mid-stream the tail can hold a half-written marker. The awkward case is a bold
// run whose closing "**" has only half arrived ("**Nhà hàng A Phủ:*"): the text
// ends in a star, so a naive `\*\*([^*]*)$` cannot reach it. Keep the characters,
// drop the markers, so nothing raw is ever painted.
export function trimPartialMarkers(src: string): string {
  let out = src;
  // An odd count means the LAST marker is an unclosed opener. Everything after it
  // is in-flight bold text, so strip every star in that tail — a regex anchored on
  // "**" cannot reach the half-arrived closer in "**Tên quán:*".
  if ((out.match(/\*\*/g)?.length ?? 0) % 2 === 1) {
    const at = out.lastIndexOf('**');
    out = out.slice(0, at) + out.slice(at + 2).replace(/\*/g, '');
  }
  if ((out.match(/`/g)?.length ?? 0) % 2 === 1) {
    const at = out.lastIndexOf('`');
    out = out.slice(0, at) + out.slice(at + 1);
  }
  return out.replace(/(^|\n)#{1,6}[ \t]*$/, '$1').replace(/(^|\n)[*+-][ \t]*$/, '$1');
}

export function parseInline(src: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: 'text', value: src.slice(last, at) });
    if (m[1] !== undefined) out.push({ type: 'strong', value: m[1] });
    else out.push({ type: 'code', value: m[2] });
    last = at + m[0].length;
  }
  if (last < src.length) out.push({ type: 'text', value: src.slice(last) });
  return out.length ? out : [{ type: 'text', value: src }];
}

// A bullet whose lead-in is bold becomes a POI card when that lead-in carries a
// parenthesised address ("Nhà hàng A Phủ (Số 15 Fansipan)"), otherwise a labeled row.
function bulletToBlock(raw: string): RichBlock {
  const bold = BOLD_LEAD_RE.exec(raw);
  if (!bold) return { kind: 'bullet', note: parseInline(raw) };

  const label = bold[1].replace(/:\s*$/, '').trim();
  const rest = bold[2].trim();
  const parens = PARENS_RE.exec(label);
  if (parens && parens[1].trim()) {
    return {
      kind: 'poi',
      name: parens[1].trim(),
      address: parens[2].trim(),
      note: parseInline(rest),
    };
  }
  return { kind: 'labeled', label, note: parseInline(rest) };
}

function headingToBlock(raw: string): RichBlock {
  let title = raw.replace(/\*\*/g, '').trim();
  let order: string | undefined;
  const lead = LEAD_NUM_RE.exec(title);
  if (lead && lead[2].trim()) {
    order = lead[1];
    title = lead[2].trim();
  }
  const parens = PARENS_RE.exec(title);
  if (parens && parens[1].trim()) {
    return { kind: 'heading', order, title: parens[1].trim(), sub: parens[2].trim() };
  }
  return { kind: 'heading', order, title };
}

export function parseRichText(src: string): RichBlock[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: RichBlock[] = [];
  let para: string[] = [];
  let callout: Extract<RichBlock, { kind: 'callout' }> | null = null;

  function closeCallout() {
    if (!callout) return;
    // A tip header with nothing under it is not a callout — keep the text.
    if (callout.items.length) blocks.push(callout);
    else blocks.push({ kind: 'para', note: parseInline(callout.title) });
    callout = null;
  }

  function push(block: RichBlock) {
    const listy = block.kind === 'poi' || block.kind === 'labeled' || block.kind === 'bullet';
    if (callout && listy) callout.items.push(block);
    else {
      closeCallout();
      blocks.push(block);
    }
  }

  function flushPara() {
    if (!para.length) return;
    const text = para.join(' ').trim();
    para = [];
    if (text) push({ kind: 'para', note: parseInline(text) });
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushPara();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      closeCallout();
      blocks.push(headingToBlock(heading[1]));
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushPara();
      push(bulletToBlock(bullet[1].trim()));
      continue;
    }

    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      flushPara();
      push({ kind: 'numbered', order: numbered[1], note: parseInline(numbered[2].trim()) });
      continue;
    }

    // A standalone bold line introduces a section; when it reads like a tip
    // header the following bullets are collected into a callout.
    const solo = BOLD_LEAD_RE.exec(line.trim());
    if (solo && !solo[2].trim()) {
      flushPara();
      closeCallout();
      const title = solo[1].replace(/:\s*$/, '').trim();
      if (TIP_RE.test(title)) callout = { kind: 'callout', title, items: [] };
      else blocks.push({ kind: 'heading', title });
      continue;
    }

    para.push(line.trim());
  }

  flushPara();
  closeCallout();
  return blocks;
}
