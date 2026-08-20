import type { Reference } from "../types";

/**
 * `[[type:id|label]]`, the inline mention syntax. Deliberately plain: it
 * survives markdown, it is unambiguous to scan, and a chip can render from
 * the mention alone before the server has resolved the value. The pattern is
 * the same one `pkg/pbuichat/mentions.go` compiles.
 */
export const MENTION_PATTERN = /\[\[([A-Za-z_][A-Za-z0-9_.-]*):([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]/g;

export interface Mention {
  type: string;
  id: string;
  label: string;
  /** Offsets of the whole mention in the scanned text. */
  start: number;
  end: number;
}

export function mentionKey(mention: Pick<Mention, "type" | "id">): string {
  return `${mention.type}:${mention.id}`;
}

/** Every mention in `text`, in order. Ids and labels are trimmed; an empty id is skipped. */
export function scanMentions(text: string): Mention[] {
  const out: Mention[] = [];
  const pattern = new RegExp(MENTION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const id = (match[2] ?? "").trim();
    if (!id) continue;
    out.push({
      type: match[1] ?? "",
      id,
      label: (match[3] ?? "").trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return out;
}

/** The first occurrence of each distinct `type:id`. */
export function uniqueMentions(mentions: readonly Mention[]): Mention[] {
  const seen = new Set<string>();
  return mentions.filter((m) => {
    const key = mentionKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Replace every mention with its label (or its id when it has none). */
export function stripMentions(text: string): string {
  return text.replace(new RegExp(MENTION_PATTERN.source, "g"), (whole) => {
    const [m] = scanMentions(whole);
    if (!m) return whole;
    return m.label || m.id;
  });
}

/** Render a reference as a mention. The label may not contain `]` or a newline. */
export function formatMention(reference: Pick<Reference, "type" | "id">, label?: string): string {
  const safeLabel = label?.replace(/[\]\n]/g, " ").trim();
  return safeLabel ? `[[${reference.type}:${reference.id}|${safeLabel}]]` : `[[${reference.type}:${reference.id}]]`;
}

export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; mention: Mention };

/** Split text into plain runs and mentions, preserving order. */
export function splitMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const mention of scanMentions(text)) {
    if (mention.start > cursor) segments.push({ kind: "text", text: text.slice(cursor, mention.start) });
    segments.push({ kind: "mention", mention });
    cursor = mention.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}
