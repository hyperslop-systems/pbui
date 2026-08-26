import { Button, JsonBlock, Text, TextArea, Toolbar } from "@hyperslop-systems/pbui";
import { useEffect, useState } from "react";
import styles from "./InspectorTile.module.css";

export interface StatePaneProps {
  state: unknown;
  /** Install a new state; the tile re-renders from it. */
  onApply(next: unknown): void;
  onReset(): void;
  disabled?: boolean;
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * The view's program state: read-only above, editable below. The editor
 * follows the live state until the user types; *apply* installs what they
 * typed (or shows the JSON error), *reset* goes back to `initialState`.
 */
export function StatePane({ state, onApply, onReset, disabled }: StatePaneProps) {
  const live = pretty(state);
  const [draft, setDraft] = useState(live);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) setDraft(live);
  }, [live, dirty]);

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(draft);
      setProblem(null);
      setDirty(false);
      onApply(parsed);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <JsonBlock value={state ?? null} maxHeight={160} />
      <TextArea
        code
        rows={6}
        value={draft}
        onValueChange={(next) => {
          setDraft(next);
          setDirty(next !== live);
        }}
        accessibleName="program state editor"
        invalid={problem !== null}
        disabled={disabled}
      />
      {problem ? (
        <Text size="tiny" tone="danger" className={styles.mono}>
          {problem}
        </Text>
      ) : null}
      <Toolbar tight>
        <Button size="tiny" variant="raised" onClick={apply} disabled={disabled || !dirty}>
          apply
        </Button>
        <Button
          size="tiny"
          variant="framed"
          onClick={() => {
            setDirty(false);
            setProblem(null);
            setDraft(live);
          }}
          disabled={!dirty}
        >
          discard
        </Button>
        <span className={styles.spacer} />
        <Button size="tiny" variant="framed" onClick={onReset} disabled={disabled}>
          reset to initialState
        </Button>
      </Toolbar>
    </>
  );
}
