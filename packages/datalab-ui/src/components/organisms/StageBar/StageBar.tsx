import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useMeQuery } from "../../../api/client";
import { useCurrentStageId, useDatalabWorkbench } from "../../../appkit/DatalabWorkbenchContext";
import type { RootState } from "../../../store";
import { stageIsVisible } from "../../../store/stages";
import { Presentation, usePbui } from "../../../pbui";
import { Text, IconButton, SelectInput } from "@hyperslop-systems/pbui";
import styles from "./StageBar.module.css";

/**
 * The stage switcher, at the right end of the masthead.
 *
 * "Always accessible with a button on the top right that is used to manage
 * account, stored workspace templates, etc." — the request's item 3. The button
 * is a stage switcher because account management *is* a stage (DR-58): there is
 * no separate account menu to keep in step with the stage list.
 *
 * The stage definitions come from navigation metadata; the CURRENT stage is
 * derived from the workspace the core has selected (design §5.2), so there
 * is no second pointer for this control to keep in step.
 *
 * ## Why the name is repeated beside the control
 *
 * A `<select>` shows its own value, so the leading `▸ work` looks redundant.
 * It is not: the select is 9.5px native chrome at the far right of a dark
 * masthead, and "which part of the product am I in" is the one fact this bar
 * exists to state. The prose answer stays legible when the control is not.
 */
export function StageBar() {
  const pbui = usePbui();
  const workbench = useDatalabWorkbench();
  const all = useSelector((state: RootState) => state.navigation.stages);
  const currentId = useCurrentStageId();
  const current = all.find((stage) => stage.id === currentId);

  /**
   * Two filters, and the current stage is always listed whatever they say.
   *
   * **1. A stage that hides the switcher is not offered BY the switcher.**
   * Selecting a stage whose chrome includes no stage bar strands the user
   * there with no route back short of clearing storage.
   *
   * **2. A stage this caller may not see is not offered either** (DATADROP-14
   * DR-94). `stageIsVisible` is the same function the gate in `Workbench`
   * uses, deliberately — two copies of "which stages exist for whom" produce
   * a switcher that offers a stage the gate immediately moves you off.
   *
   * The `id === currentId` escape is not a courtesy. A `<select>` whose value
   * matches no option renders blank and silently reassigns on the next change;
   * and during the frame between `/v1/me` arriving and the gate's effect
   * running, the current stage legitimately IS one this caller may not see.
   */
  const { data: me } = useMeQuery();
  const authed = me?.authenticated === true;

  const stages = useMemo(
    () =>
      all.filter(
        (stage) =>
          stage.id === currentId || (stage.chrome.stageBar && stageIsVisible(stage, authed)),
      ),
    [all, currentId, authed],
  );

  if (!current) return null;

  /**
   * The stage's own name is a presentation, so its verbs live in one place.
   *
   * Export, import and inspect are reached by right-clicking the name or by the
   * `▾` button, which calls `openMenu` with the same value — one line, and it
   * means the switcher is not a second mechanism with its own copy of the stage
   * verbs to keep in step.
   */
  const value = {
    stageId: current.id,
    name: current.name,
    pinned: current.pinned === true,
    current: true,
  };

  const name = (
    <Presentation reference={{ type: "stage", value }} doc={`<stage> ${current.name}`}>
      <Text size="tiny" tone="faint">
        <span className={styles.name}>▸ {current.name}</span>
      </Text>
    </Presentation>
  );

  // One stage is not a choice. A tour panel seeds exactly one and would
  // otherwise render a switcher that cannot switch — furniture that reads as a
  // control. The name stays, and stays right-clickable.
  if (stages.length < 2) return <span className={styles.bar}>{name}</span>;

  return (
    <span className={styles.bar}>
      {name}
      <SelectInput
        accessibleName="stage"
        variant="framed"
        size="tiny"
        value={currentId}
        onValueChange={(id) => void workbench.controller.selectStage(id)}
        options={stages.map((stage) => ({
          value: stage.id,
          // `⌾` is the same marker the workspace strip uses for a code-defined
          // object, so one glyph means one thing at both levels.
          label: stage.pinned ? `⌾ ${stage.name}` : stage.name,
        }))}
      />
      <IconButton
        variant="framed"
        size="tiny"
        glyph="▾"
        accessibleName="this stage's verbs"
        title="export, import, inspect — the same menu as a right-click"
        onClick={(event) => {
          // `stopPropagation` for the same reason `Presentation.onClick` does
          // it: an open object menu installs a window-level click listener that
          // closes it, and that listener runs AFTER this handler.
          event.stopPropagation();
          const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
          pbui.openMenu({ type: "stage", value }, box.left, box.bottom);
        }}
      />
    </span>
  );
}
