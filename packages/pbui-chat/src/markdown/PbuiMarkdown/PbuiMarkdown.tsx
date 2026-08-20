import { CodeText, Text } from "@hyperslop-systems/pbui";
import { Fragment, type ReactNode } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { MENTION_PATTERN } from "../../mentions/mentions";
import { resolveMention, useReferenceIndex, type ReferenceIndex } from "../../refs/referenceIndex";
import type { Reference } from "../../types";
import styles from "./PbuiMarkdown.module.css";

export interface PbuiMarkdownProps {
  text: string;
  /**
   * References to consult before falling back to `unresolved`, keyed
   * `type:id` — a user message's own refs, which have no `pbui.refs` entity.
   */
  references?: Readonly<Record<string, Reference>>;
  className?: string;
}

/**
 * The small markdown the transcript needs, and nothing more: paragraphs on
 * blank lines, a line break on a single newline, `**bold**`, `` `code` ``,
 * `- ` bullet lists, `#` headings, and `[[type:id|label]]` mentions rendered
 * as live presentations. No remark, no HTML — the model's prose is untrusted
 * and this renderer has no way to emit markup from it.
 */
export function PbuiMarkdown({ text, references, className }: PbuiMarkdownProps) {
  const index = useReferenceIndex();
  const blocks = splitBlocks(text);
  return (
    <div data-part="markdown" className={[styles.markdown, className ?? ""].filter(Boolean).join(" ")}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} index={index} references={references} />
      ))}
    </div>
  );
}

type MarkdownBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "heading"; text: string }
  | { kind: "code"; text: string };

export function splitBlocks(text: string): MarkdownBlock[] {
  const out: MarkdownBlock[] = [];
  const normalized = text.replace(/\r\n?/g, "\n");
  // Fenced code first, so blank lines inside a fence do not split it.
  const fence = /```[^\n]*\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pushProse = (chunk: string) => {
    for (const raw of chunk.split(/\n\s*\n/)) {
      const lines = raw.split("\n").filter((line) => line.trim() !== "");
      if (lines.length === 0) continue;
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        out.push({ kind: "list", items: lines.map((line) => line.replace(/^\s*[-*]\s+/, "")) });
      } else if (lines.length === 1 && /^#{1,6}\s+/.test(lines[0] ?? "")) {
        out.push({ kind: "heading", text: (lines[0] ?? "").replace(/^#{1,6}\s+/, "") });
      } else {
        out.push({ kind: "paragraph", lines });
      }
    }
  };
  while ((match = fence.exec(normalized)) !== null) {
    pushProse(normalized.slice(cursor, match.index));
    out.push({ kind: "code", text: (match[1] ?? "").replace(/\n$/, "") });
    cursor = match.index + match[0].length;
  }
  pushProse(normalized.slice(cursor));
  return out;
}

function Block({
  block,
  index,
  references,
}: {
  block: MarkdownBlock;
  index: ReferenceIndex;
  references?: Readonly<Record<string, Reference>>;
}) {
  switch (block.kind) {
    case "heading":
      return (
        <Text as="p" size="small" strong className={styles.heading}>
          <Inline text={block.text} index={index} references={references} />
        </Text>
      );
    case "list":
      return (
        <ul className={styles.list} data-part="markdown-list">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} index={index} references={references} />
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre className={styles.pre} data-part="markdown-code">
          <CodeText size="small" wrapAnywhere>
            {block.text}
          </CodeText>
        </pre>
      );
    case "paragraph":
      return (
        <p className={styles.paragraph} data-part="markdown-paragraph">
          {block.lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              <Inline text={line} index={index} references={references} />
            </Fragment>
          ))}
        </p>
      );
  }
}

const INLINE = new RegExp(`${MENTION_PATTERN.source}|\\*\\*([^*\\n]+)\\*\\*|\`([^\`\\n]+)\``, "g");

function Inline({
  text,
  index,
  references,
}: {
  text: string;
  index: ReferenceIndex;
  references?: Readonly<Record<string, Reference>>;
}) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(INLINE.source, "g");
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const [whole, type, rawId, rawLabel, bold, code] = match;
    if (type !== undefined && rawId !== undefined) {
      const id = rawId.trim();
      if (id) {
        nodes.push(
          <Mention key={match.index} type={type} id={id} label={(rawLabel ?? "").trim()} index={index} references={references} />,
        );
      } else {
        nodes.push(whole);
      }
    } else if (bold !== undefined) {
      nodes.push(<strong key={match.index}>{bold}</strong>);
    } else if (code !== undefined) {
      nodes.push(<CodeText key={match.index}>{code}</CodeText>);
    }
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function Mention({
  type,
  id,
  label,
  index,
  references,
}: {
  type: string;
  id: string;
  label: string;
  index: ReferenceIndex;
  references?: Readonly<Record<string, Reference>>;
}) {
  const chat = usePbuiChat();
  const reference = resolveMention(index, type, id, label, references);
  const resolvedLabel = label || chat.labelFor(reference) || id;
  return (
    <RefPresentation reference={reference} className={styles.mention} testId={`mention-${type}-${id}`}>
      {resolvedLabel}
    </RefPresentation>
  );
}
