/**
 * Converts the HTML descriptions supplied by the external provider into plain
 * text. Removing every tag (instead of trying to allow "safe" HTML) means the
 * frontend can render the result as ordinary text, so no external markup,
 * script, event handler or link is ever interpreted by the browser.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  deg: '°',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: unknown): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  const text = html
    // Drop elements whose content must never be shown.
    .replace(/<(script|style|iframe|object|embed|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|template)\b[^>]*>/gi, '')
    // Keep the document structure as line breaks and bullets.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr|blockquote)\s*>/gi, '\n')
    // Remove every remaining tag, then decode entities (decoded "<" is plain text).
    .replace(/<[^>]*>/g, '')
    .replace(/<|>/g, '');
  return decodeEntities(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Shortens text to `max` characters at a word boundary, adding an ellipsis. */
export function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
