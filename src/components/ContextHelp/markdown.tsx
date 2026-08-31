import { Fragment } from "react";
import type { ReactNode } from "react";
import { CodeText, Text } from "../foundation";

/**
 * The bounded help Markdown (design doc §9.2): the generic subset of the
 * pbui-chat transcript renderer — paragraphs on blank lines, a line break on
 * a single newline, `**strong**`, `` `code` ``, `- ` bullet lists, `#`
 * headings, fenced code blocks — WITHOUT chat `[[type:id|label]]` mentions.
 * No remark, no plugins, and no HTML path exists: authored prose becomes
 * text nodes only, so there is nothing `dangerouslySetInnerHTML`-shaped to
 * misuse. Interpolated dynamic values cannot break out of the syntax, but
 * arbitrary user-controlled strings still belong in the fields item, not in
 * authored Markdown.
 */

export type HelpMarkdownBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "heading"; text: string }
  | { kind: "code"; text: string };

export function splitHelpMarkdownBlocks(text: string): HelpMarkdownBlock[] {
  const out: HelpMarkdownBlock[] = [];
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

const INLINE = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;

function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(INLINE.source, "g");
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const [whole, strong, code] = match;
    if (strong !== undefined) {
      nodes.push(<strong key={match.index}>{strong}</strong>);
    } else if (code !== undefined) {
      nodes.push(<CodeText key={match.index}>{code}</CodeText>);
    } else {
      nodes.push(whole);
    }
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export interface HelpMarkdownProps {
  markdown: string;
  /** Tighter typography for a short one-item card. */
  compact?: boolean;
}

export function HelpMarkdown({ markdown, compact = false }: HelpMarkdownProps) {
  const blocks = splitHelpMarkdownBlocks(markdown);
  const size = compact ? "tiny" : "small";
  return (
    <div data-part="help-markdown" data-compact={compact || undefined}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return (
              <Text key={index} as="p" size={size} strong>
                <Inline text={block.text} />
              </Text>
            );
          case "list":
            return (
              <ul key={index} data-part="help-markdown-list">
                {block.items.map((item, i) => (
                  <li key={i}>
                    <Text size={size} prose>
                      <Inline text={item} />
                    </Text>
                  </li>
                ))}
              </ul>
            );
          case "code":
            return (
              <pre key={index} data-part="help-markdown-code">
                <CodeText size="tiny" wrapAnywhere>
                  {block.text}
                </CodeText>
              </pre>
            );
          case "paragraph":
            return (
              <Text key={index} as="p" size={size} prose>
                {block.lines.map((line, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    <Inline text={line} />
                  </Fragment>
                ))}
              </Text>
            );
        }
      })}
    </div>
  );
}
