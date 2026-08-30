/**
 * qwenproxy-private tool-call marker.
 *
 * The upstream provider (Qwen) intercepts and corrupts the conventional
 * `<tool_call>` token, so we deliberately use a tag that does NOT contain the
 * `tool_call` substring. Every place that *emits* (prompt instructions) or
 * *parses* (response parser) tool calls reads from this module, so the two
 * sides can never drift apart.
 *
 * Override with QWEN_TOOL_OPEN / QWEN_TOOL_CLOSE if a different marker is needed
 * (e.g. to dodge a future provider filter that learns this one).
 */

const DEFAULT_OPEN = '<qpx_call>';
const DEFAULT_CLOSE = '</qpx_call>';

export const TOOL_CALL_OPEN: string = (process.env.QWEN_TOOL_OPEN || DEFAULT_OPEN).trim() || DEFAULT_OPEN;
export const TOOL_CALL_CLOSE: string = (process.env.QWEN_TOOL_CLOSE || DEFAULT_CLOSE).trim() || DEFAULT_CLOSE;

function tagName(tag: string): string {
  return tag.replace(/^<\/?/, '').replace(/>$/, '').trim();
}

function openRegexFor(name: string): RegExp {
  return new RegExp(`<${name}\\b[^>]*>`, 'i');
}

// We still accept the legacy `<tool_call>` token when parsing model output, so
// in-flight sessions and models that happen to emit it keep working. The provider
// mangles it, but when it slips through we parse it correctly.
export function getOpenNames(): string[] {
  return Array.from(new Set([tagName(TOOL_CALL_OPEN), 'tool_call']));
}

export function getCloseNames(): string[] {
  return Array.from(new Set([tagName(TOOL_CALL_CLOSE), 'tool_call', 'tool']));
}

export function wrapToolCallPayload(json: string): string {
  return `${TOOL_CALL_OPEN}\n${json}\n${TOOL_CALL_CLOSE}`;
}

function matchesAt(buffer: string, i: number, value: string): boolean {
  if (i + value.length > buffer.length) return false;
  for (let j = 0; j < value.length; j++) {
    const c = buffer.charCodeAt(i + j);
    const t = value.charCodeAt(j);
    if (c !== t && (c | 0x20) !== (t | 0x20)) return false;
  }
  return true;
}

/** Find the first open tag in `buffer`. Returns position/length/tag or null. */
export function findToolOpen(buffer: string): { index: number; length: number; tag: string } | null {
  let best: { index: number; length: number; tag: string } | null = null;
  for (const name of getOpenNames()) {
    const m = buffer.match(openRegexFor(name));
    if (m && m.index !== undefined) {
      if (!best || m.index < best.index) {
        best = { index: m.index, length: m[0].length, tag: m[0] };
      }
    }
  }
  return best;
}

/**
 * At buffer position `i`, is there a close tag (whitespace before `>` allowed)?
 * Returns the total length consumed or null. Iterates over every accepted close
 * name (custom + legacy), so it tolerates the provider's `</tool_call >` spacing
 * as well as our private `</qpx_call>`.
 */
export function matchToolCloseAt(buffer: string, i: number): number | null {
  for (const name of getCloseNames()) {
    const full = `</${name}`;
    if (!matchesAt(buffer, i, full)) continue;
    let j = i + full.length;
    while (j < buffer.length && /\s/.test(buffer[j])) j++;
    if (buffer[j] === '>') return j + 1 - i;
  }
  return null;
}

/** Bare name of an open tag actually seen in the stream (e.g. 'qpx_call'). */
export function openTagName(openTag: string): string {
  const m = openTag.match(/^<\/?([a-zA-Z_][\w-]*)/);
  return m ? m[1] : tagName(TOOL_CALL_OPEN);
}

/** Close tag string corresponding to an open tag actually seen in the stream. */
export function closeTagFor(openTag: string): string {
  return `</${openTagName(openTag)}>`;
}

/** True when `text` looks like it begins a tool-call block (any accepted tag). */
export function textContainsToolCallStart(text: string): boolean {
  const lower = text.toLowerCase();
  for (const name of getOpenNames()) {
    if (lower.includes(`<${name.toLowerCase()}`)) return true;
  }
  return lower.includes('<tool_call');
}
