import { Callout, Text } from "@hyperslop-systems/pbui";
import type { CSSProperties } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { toneVar } from "../../tone";
import type { Reference } from "../../types";
import type { WidgetDocument } from "../../vocabulary/schemas";
import { DEFAULT_WIDGET_LIMITS, validateWidgetDocument } from "../../vocabulary/validate";
import { WidgetChild } from "../children/WidgetChild";
import { VerbChips } from "../VerbChips";
import styles from "./PbuiWidget.module.css";

export interface PbuiWidgetProps {
  document: WidgetDocument;
  instanceId?: string;
  /** chat-provider's widget status: `STREAMING` / `READY` / … */
  status?: string;
  parentMessageId?: string;
  /** Skip validation when the caller already validated (the outlet does). */
  validated?: boolean;
}

export function isStreamingStatus(status: string | undefined): boolean {
  return status === "STREAMING" || status === "WIDGET_STATUS_STREAMING";
}

/**
 * Render a widget document. The document is validated against the same
 * rules the server applies (`validateWidgetDocument`), and a document that
 * fails renders the reason rather than a broken page — an error is a widget
 * too. The title is a `<widget>` presentation, so the widget itself has a
 * menu (open in tile, inspect, ask the agent).
 */
export function PbuiWidget({ document, instanceId = "widget", status, parentMessageId, validated = false }: PbuiWidgetProps) {
  const chat = usePbuiChat();
  const problem = validated ? null : validateWidgetDocument(chat.vocabulary, document, DEFAULT_WIDGET_LIMITS, { verbs: "lenient" });
  if (problem) {
    return (
      <Callout variant="danger" title="invalid widget document">
        {problem}
      </Callout>
    );
  }

  const widgetReference: Reference = {
    type: "widget",
    id: instanceId,
    value: { title: document.title, parentMessageId, status: status ?? "READY" },
  };

  return (
    <Document
      document={document}
      depth={1}
      instanceId={instanceId}
      status={status}
      header={
        document.title ? (
          <RefPresentation reference={widgetReference} testId={`widget-title-${instanceId}`}>
            <Text size="small" strong>
              {document.title}
            </Text>
          </RefPresentation>
        ) : null
      }
    />
  );
}

function Document({
  document,
  depth,
  instanceId,
  status,
  header,
}: {
  document: WidgetDocument;
  depth: number;
  instanceId: string;
  status?: string;
  header?: React.ReactNode;
}) {
  const layout = document.layout ?? "stack";
  const style = {
    "--pbui-chat-widget-tone": toneVar(document.tone, "var(--pbui-tone-widget, var(--pbui-tone-neutral))"),
    "--pbui-chat-columns": document.columns ?? 2,
  } as CSSProperties;
  const nested = depth > 1;

  return (
    <section
      data-part={nested ? "widget-nested" : "widget"}
      data-state={isStreamingStatus(status) ? "streaming" : undefined}
      data-layout={layout}
      data-depth={depth}
      className={[styles.widget, nested ? styles.nested : ""].filter(Boolean).join(" ")}
      style={style}
      aria-label={document.title ?? "widget"}
    >
      {(header || (nested && document.title)) && (
        <header data-part="widget-title" className={styles.title}>
          {header ?? (
            <Text size="small" strong>
              {document.title}
            </Text>
          )}
          {isStreamingStatus(status) && (
            <Text size="tiny" tone="faint" className={styles.streaming}>
              streaming┆
            </Text>
          )}
        </header>
      )}
      <div data-part="widget-body" className={[styles.body, styles[layout]].join(" ")}>
        {document.children.map((child, i) => (
          <div key={i} data-part="widget-child" data-kind={child.kind} className={styles.child}>
            <WidgetChild
              child={child}
              depth={depth}
              instanceId={instanceId}
              renderDocument={(inner, innerDepth) => (
                <Document document={inner} depth={innerDepth} instanceId={`${instanceId}/${i}`} />
              )}
            />
          </div>
        ))}
      </div>
      {document.verbs && document.verbs.length > 0 && <VerbChips verbs={document.verbs} />}
    </section>
  );
}
