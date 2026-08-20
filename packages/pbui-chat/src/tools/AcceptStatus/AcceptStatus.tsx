import { Text } from "@hyperslop-systems/pbui";
import styles from "./AcceptStatus.module.css";

export interface AcceptStatusProps {
  types: readonly string[];
  prompt: string;
  /** Present once the tool has settled. */
  outcome?: { kind: "picked"; label: string; type: string } | { kind: "cancelled" };
}

/**
 * The one-line status of a `pbui_accept` call. While pending, the
 * `AcceptBanner` is the real UI — this line only says what the agent is
 * waiting for, in the transcript where the request came from.
 */
export function AcceptStatus({ types, prompt, outcome }: AcceptStatusProps) {
  const wanted = types.join(" | ");
  return (
    <div data-part="accept-status" data-state={outcome ? outcome.kind : "pending"} className={styles.line} role="status">
      {!outcome && (
        <Text size="small" tone="faint">
          waiting for you to pick a &lt;{wanted}&gt; — {prompt} — click any presentation, Esc cancels
        </Text>
      )}
      {outcome?.kind === "picked" && (
        <Text size="small">
          you picked &lt;{outcome.type}&gt; {outcome.label}
        </Text>
      )}
      {outcome?.kind === "cancelled" && (
        <Text size="small" tone="faint">
          pick cancelled — the agent was told
        </Text>
      )}
    </div>
  );
}
