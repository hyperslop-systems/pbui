import { Button } from "@hyperslop-systems/pbui";
import { usePbuiChat } from "../../context";
import type { VerbChip } from "../../vocabulary/schemas";
import { validateVerb } from "../../vocabulary/validate";
import styles from "./VerbChips.module.css";

export interface VerbChipsProps {
  verbs: readonly VerbChip[];
}

/**
 * The verb chips under a widget. Each is validated against the vocabulary
 * before it is enabled; an invalid one is SHOWN, disabled, with the reason
 * in its title — hiding it would hide the rule that made it unavailable.
 */
export function VerbChips({ verbs }: VerbChipsProps) {
  const chat = usePbuiChat();
  const pbui = chat.pbui.usePbui();
  if (verbs.length === 0) return null;
  return (
    <div data-part="verb-chips" className={styles.chips}>
      {verbs.map((chip, i) => {
        const reason = validateVerb(chat.vocabulary, chip.verb);
        const doc = chat.vocabulary.verbs[String(chip.verb.kind)]?.doc;
        return (
          <Button
            key={`${i}-${chip.label}`}
            variant="framed"
            size="tiny"
            tone={chip.danger ? "danger" : "default"}
            disabled={reason !== null}
            title={reason ?? doc}
            data-part="verb-chip"
            data-state={reason ? "disabled" : undefined}
            data-verb={String(chip.verb.kind)}
            onClick={() => void pbui.perform(chip.verb)}
          >
            {chip.label}
            {reason && <span className={styles.reason}> — {reason}</span>}
          </Button>
        );
      })}
    </div>
  );
}
