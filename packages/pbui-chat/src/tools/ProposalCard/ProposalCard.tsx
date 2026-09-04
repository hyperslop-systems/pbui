import { Button, Chip, Surface, Text } from "@hyperslop-systems/pbui";
import { RefPresentation } from "../../components/RefPresentation";
import { PbuiMarkdown } from "../../markdown/PbuiMarkdown";
import type { Reference } from "../../types";
import styles from "./ProposalCard.module.css";

export type ProposalDecision = "approve" | "reject";

export interface ProposalCardProps {
  id: string;
  toolCallId: string;
  title: string;
  body: string;
  danger?: boolean;
  fields?: readonly { label: string; value: string }[];
  /** Present once decided; the buttons are then disabled. */
  decision?: ProposalDecision;
  onDecide?(decision: ProposalDecision): void;
}

/**
 * A consequential action awaiting a human. The card IS a `<proposal>`
 * presentation — its menu offers the same approve/reject the buttons do —
 * and once decided it stays in the transcript showing what was decided,
 * because a trace that forgets decisions is not a trace.
 */
export function ProposalCard({ id, toolCallId, title, body, danger = false, fields, decision, onDecide }: ProposalCardProps) {
  const reference: Reference = {
    type: "proposal",
    id,
    value: {
      toolCallId,
      title,
      body,
      danger,
      ...(fields ? { fields: [...fields] } : {}),
      ...(decision ? { decision: { by: "you", at: new Date().toISOString(), value: decision } } : {}),
    },
    provenance: { toolCallId },
  };
  const disabledBecause = decision ? `already ${decision === "approve" ? "approved" : "rejected"}` : undefined;

  return (
    <Surface
      tone="pane"
      border="none"
      padding={3}
      className={styles.card}
      role="group"
      aria-label={`proposal: ${title}`}
    >
      <div data-part="proposal" data-danger={danger || undefined} data-state={decision ?? "pending"} className={styles.inner}>
        <header className={styles.header}>
          <RefPresentation reference={reference} testId={`proposal-${id}`}>
            <Text size="small" strong>
              {title}
            </Text>
          </RefPresentation>
          {danger && <Chip label="danger" tone="var(--pbui-danger)" />}
          {decision && (
            <Chip
              label={decision === "approve" ? "approved" : "rejected"}
              tone={decision === "approve" ? "var(--pbui-ok)" : "var(--pbui-danger)"}
              strong
            />
          )}
        </header>
        {body && <PbuiMarkdown text={body} />}
        {fields && fields.length > 0 && (
          <dl className={styles.fields}>
            {fields.map((field) => (
              <div key={field.label} className={styles.field}>
                <dt>
                  <Text size="tiny" tone="faint">
                    {field.label}
                  </Text>
                </dt>
                <dd>
                  <Text size="small">{field.value}</Text>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className={styles.actions} data-part="proposal-actions">
          <Button
            variant="raised"
            size="small"
            tone={danger ? "danger" : "default"}
            disabled={disabledBecause !== undefined}
            title={disabledBecause}
            data-decision="approve"
            onClick={() => onDecide?.("approve")}
          >
            Approve
          </Button>
          <Button
            variant="framed"
            size="small"
            disabled={disabledBecause !== undefined}
            title={disabledBecause}
            data-decision="reject"
            onClick={() => onDecide?.("reject")}
          >
            Reject
          </Button>
        </div>
      </div>
    </Surface>
  );
}
