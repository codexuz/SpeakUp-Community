import type { MessageEntity } from './chat';

// ─── HTML ↔ Entities converters (for react-native-enriched) ──

/** Escape HTML special characters */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert plain text + entities into the HTML format used by react-native-enriched.
 * Each paragraph (<p>) wraps lines; inline styles use <b>, <i>, <u>, <code>, <a>.
 */
export function entitiesToHtml(
  text: string,
  entities?: MessageEntity[] | null,
): string {
  if (!text) return '<p><br></p>';

  // Build character-level open/close tags from entities
  const sorted = entities ? [...entities].sort(
    (a, b) => a.offset - b.offset || b.length - a.length,
  ) : [];

  type Tag = { open: string; close: string };
  const opens: Map<number, Tag[]> = new Map();
  const closes: Map<number, Tag[]> = new Map();

  for (const ent of sorted) {
    const tag = entityToHtmlTag(ent);
    if (!tag) continue;
    const start = ent.offset;
    const end = ent.offset + ent.length;
    if (!opens.has(start)) opens.set(start, []);
    opens.get(start)!.push(tag);
    if (!closes.has(end)) closes.set(end, []);
    closes.get(end)!.unshift(tag);
  }

  // Build inline-marked text
  let marked = '';
  for (let i = 0; i < text.length; i++) {
    if (closes.has(i)) {
      for (const t of closes.get(i)!) marked += t.close;
    }
    if (opens.has(i)) {
      for (const t of opens.get(i)!) marked += t.open;
    }
    marked += escapeHtml(text[i]);
  }
  if (closes.has(text.length)) {
    for (const t of closes.get(text.length)!) marked += t.close;
  }

  // Wrap lines in <p> tags
  const lines = marked.split('\n');
  return lines.map((l) => (l ? `<p>${l}</p>` : '<p><br></p>')).join('');
}

function entityToHtmlTag(
  ent: MessageEntity,
): { open: string; close: string } | null {
  switch (ent.type) {
    case 'bold':
      return { open: '<b>', close: '</b>' };
    case 'italic':
      return { open: '<i>', close: '</i>' };
    case 'underline':
      return { open: '<u>', close: '</u>' };
    case 'code':
      return { open: '<code>', close: '</code>' };
    case 'pre':
      return { open: '<codeblock><p>', close: '</p></codeblock>' };
    case 'text_link':
      return { open: `<a href="${ent.url}">`, close: '</a>' };
    case 'mention':
    case 'text_mention':
      return { open: '<b>', close: '</b>' };
    default:
      return null;
  }
}

/**
 * Parse HTML from react-native-enriched into plain text + entities.
 * Handles <b>, <i>, <u>, <code>, <codeblock>, <a>, <p>, <br>.
 */
export function htmlToEntities(
  html: string,
): { text: string; entities: MessageEntity[] } {
  const entities: MessageEntity[] = [];
  let plain = '';

  // Stack-based parser
  const stack: { type: MessageEntity['type']; offset: number; url?: string }[] = [];

  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const closeAngle = html.indexOf('>', i);
      if (closeAngle === -1) {
        plain += html[i];
        i++;
        continue;
      }
      const tagContent = html.slice(i + 1, closeAngle);
      const isClosing = tagContent.startsWith('/');
      const tagName = isClosing
        ? tagContent.slice(1).split(/[\s>]/)[0].toLowerCase()
        : tagContent.split(/[\s/>]/)[0].toLowerCase();

      if (isClosing) {
        // Close tag — find matching stack entry
        for (let j = stack.length - 1; j >= 0; j--) {
          const entry = stack[j];
          const matchTag = tagToEntityType(tagName);
          if (matchTag && entry.type === matchTag) {
            const length = plain.length - entry.offset;
            if (length > 0) {
              const ent: MessageEntity = {
                type: entry.type,
                offset: entry.offset,
                length,
              };
              if (entry.url) (ent as any).url = entry.url;
              entities.push(ent);
            }
            stack.splice(j, 1);
            break;
          }
        }
      } else if (tagName === 'br') {
        plain += '\n';
      } else if (tagName === 'p') {
        // Add newline for paragraph separation (but not for first)
        if (plain.length > 0 && !plain.endsWith('\n')) {
          plain += '\n';
        }
      } else {
        // Open tag
        const entityType = tagToEntityType(tagName);
        if (entityType) {
          let url: string | undefined;
          if (tagName === 'a') {
            const hrefMatch = tagContent.match(/href="([^"]*)"/);
            if (hrefMatch) url = hrefMatch[1];
          }
          stack.push({ type: entityType, offset: plain.length, url });
        }
      }
      i = closeAngle + 1;
    } else if (html.startsWith('&amp;', i)) {
      plain += '&';
      i += 5;
    } else if (html.startsWith('&lt;', i)) {
      plain += '<';
      i += 4;
    } else if (html.startsWith('&gt;', i)) {
      plain += '>';
      i += 4;
    } else if (html.startsWith('&nbsp;', i)) {
      plain += ' ';
      i += 6;
    } else if (html.startsWith('&quot;', i)) {
      plain += '"';
      i += 6;
    } else {
      plain += html[i];
      i++;
    }
  }

  // Trim trailing newline that paragraph wrapping adds
  if (plain.endsWith('\n')) {
    plain = plain.slice(0, -1);
  }

  return { text: plain, entities: entities.length > 0 ? entities : [] };
}

function tagToEntityType(tag: string): MessageEntity['type'] | null {
  switch (tag) {
    case 'b':
    case 'strong':
      return 'bold';
    case 'i':
    case 'em':
      return 'italic';
    case 'u':
      return 'underline';
    case 'code':
      return 'code';
    case 'codeblock':
      return 'pre';
    case 'a':
      return 'text_link';
    default:
      return null;
  }
}
