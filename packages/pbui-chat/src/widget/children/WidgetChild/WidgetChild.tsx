import { Callout, Chip, Meter, SegmentedBar, Sparkline, Swatch, Text } from "@hyperslop-systems/pbui";
import type { ReactNode } from "react";
import { RefPresentation } from "../../../components/RefPresentation";
import { usePbuiChat } from "../../../context";
import { PbuiMarkdown } from "../../../markdown/PbuiMarkdown";
import { calloutVariant, toneVar } from "../../../tone";
import type { Reference } from "../../../types";
import type { WidgetChild as WidgetChildDocument, WidgetDocument } from "../../../vocabulary/schemas";
import { FormChild } from "../FormChild";
import { LogChild } from "../LogChild";
import { StatChild } from "../StatChild";
import { TableChild } from "../TableChild";
import styles from "./WidgetChild.module.css";

export interface WidgetChildProps {
  child: WidgetChildDocument;
  /** Nesting depth of the enclosing document, 1 at the top. */
  depth: number;
  /** The enclosing widget's instance id; tables without a `docId` use it. */
  instanceId: string;
  /** The nested-document renderer, injected to avoid an import cycle. */
  renderDocument: (document: WidgetDocument, depth: number) => ReactNode;
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.labelled}>
      <Text size="tiny" tone="faint" className={styles.label}>
        {label}
      </Text>
      {children}
    </div>
  );
}

function RefWrap({ reference, children }: { reference?: Reference; children: ReactNode }) {
  if (!reference) return <>{children}</>;
  return (
    <RefPresentation reference={reference} block className={styles.refWrap}>
      {children}
    </RefPresentation>
  );
}

/**
 * One child of a widget document, mapped onto the design system. Unknown
 * kinds render a callout naming the kind — forward compatibility by
 * construction: a newer server never breaks an older client's page.
 */
export function WidgetChild({ child, depth, instanceId, renderDocument }: WidgetChildProps) {
  const chat = usePbuiChat();
  const kind = (child as { kind: string }).kind;

  switch (child.kind) {
    case "text":
      return child.markdown === false ? (
        <Text as="p" size="base" prose>
          {child.text}
        </Text>
      ) : (
        <PbuiMarkdown text={child.text} />
      );

    case "refs":
      return (
        <div data-part="refs" className={styles.refs}>
          {child.label && (
            <Text size="tiny" tone="faint" className={styles.label}>
              {child.label}
            </Text>
          )}
          <div className={styles.chips}>
            {child.refs.map((reference) => (
              <RefPresentation key={`${reference.type}:${reference.id}`} reference={reference}>
                <Chip label={chat.labelFor(reference)} tone={toneVar(chat.toneFor(reference.type) ?? reference.type)} />
              </RefPresentation>
            ))}
          </div>
        </div>
      );

    case "meter": {
      const max = child.max && child.max > 0 ? child.max : 1;
      return (
        <RefWrap reference={child.ref}>
          <Labelled label={child.label}>
            <Meter
              fraction={Math.max(0, Math.min(1, child.value / max))}
              accessibleName={child.label}
              value={child.max !== undefined ? `${child.value} / ${child.max}` : String(child.value)}
              tone="var(--pbui-chat-widget-tone, var(--pbui-cat-1))"
              alarm={child.value / max >= 0.9}
            />
          </Labelled>
        </RefWrap>
      );
    }

    case "sparkline":
      return (
        <RefWrap reference={child.ref}>
          <Labelled label={child.label}>
            <Sparkline points={child.values} accessibleName={child.label} tone="var(--pbui-chat-widget-tone, var(--pbui-cat-2))" />
          </Labelled>
        </RefWrap>
      );

    case "segmented":
      return (
        <Labelled label={child.label}>
          <SegmentedBar
            accessibleName={child.label}
            segments={child.parts.map((part, i) => ({
              id: `${i}-${part.label}`,
              weight: Math.max(0, part.value),
              tone: toneVar(part.tone, `var(--pbui-cat-${(i % 8) + 1})`),
              label: `${part.label}: ${part.value}`,
            }))}
            summary={
              <span className={styles.legend}>
                {child.parts.map((part, i) => (
                  <span key={`${i}-${part.label}`} className={styles.legendItem}>
                    <Swatch color={toneVar(part.tone, `var(--pbui-cat-${(i % 8) + 1})`)} label={part.label} />
                    <Text size="tiny">
                      {part.label} {part.value}
                    </Text>
                  </span>
                ))}
              </span>
            }
          />
        </Labelled>
      );

    case "stat":
      return (
        <RefWrap reference={child.ref}>
          <StatChild label={child.label} value={child.value} unit={child.unit} delta={child.delta} />
        </RefWrap>
      );

    case "callout": {
      // A note is prose; only a danger earns the notice box.
      const variant = child.tone === "danger" ? "danger" : calloutVariant(child.tone);
      if (variant !== "danger") {
        return (
          <div data-part="widget-note" className={styles.note}>
            {child.title ? (
              <Text size="small" strong>
                {child.title}
              </Text>
            ) : null}
          <PbuiMarkdown text={child.text} />
          </div>
        );
      }
      return (
        <Callout variant={variant} title={child.title}>
          <PbuiMarkdown text={child.text} />
        </Callout>
      );
    }

    case "table":
      return <TableChild child={child} fallbackDocId={instanceId} />;

    case "log":
      return <LogChild entries={child.entries} />;

    case "form":
      return <FormChild child={child} />;

    case "widget":
      return <>{renderDocument(child.document, depth + 1)}</>;

    default:
      return (
        <Callout variant="warning" title="unsupported widget child">
          this client cannot render <code>{kind}</code>
        </Callout>
      );
  }
}
