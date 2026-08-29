import { useEffect, useMemo, useState } from "react";
import { Button } from "@hyperslop-systems/pbui";
import { workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import type { Rect } from "../../rebalance/analysisTree";
import type { RebalanceConfig } from "../../rebalance/config";
import { documentRebalanceConfigStore, type RebalanceConfigStore } from "../../rebalance/configStore";
import { detectOnly } from "../../rebalance/slate";
import { measureDividerPx, measureRect } from "../RebalanceDialog/RebalanceDialog";
import styles from "./RebalanceBadge.module.css";

/**
 * The status-bar diagnosis badge (PBUI-REBALANCE-1 Phase 6): the free DETECT
 * pass, always on, rendered ONLY when something is wrong. A healthy layout
 * renders nothing — the correct behaviour on a healthy layout is to do
 * nothing, and it must cost nothing (textbook §12.1). Clicking opens the
 * rebalance dialog, which owns everything past diagnosis.
 */

export interface RebalanceBadgeProps {
  /** Same contract as `RebalanceProps`: explicit config wins over the store. */
  config?: RebalanceConfig;
  configStore?: RebalanceConfigStore;
}

const EMPTY_LABELS: ReadonlyMap<string, string> = new Map();

export function RebalanceStatusBadge({ config: configProp, configStore }: RebalanceBadgeProps) {
  const workbench = useWorkbench();
  const doc = workbench.useDocument();
  const storedConfig = (configStore ?? documentRebalanceConfigStore).useConfig(workbench);
  const config = configProp ?? storedConfig;
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);
  const [rect, setRect] = useState<Rect>(() => measureRect(workbench.root()));

  useEffect(() => {
    const element = workbench.root();
    if (!element || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => setRect(measureRect(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [workbench]);

  const tree = workspaceTree(doc, workspaceId);
  const diagnosis = useMemo(() => {
    if (!tree) return null;
    return detectOnly({ tree, rect, dividerPx: measureDividerPx(workbench.root()), labels: EMPTY_LABELS }, config);
  }, [doc, workspaceId, rect, config, workbench, tree]);

  if (!diagnosis) return null;
  const under = diagnosis.violations.length;
  const overflow = diagnosis.capacity.overflow;
  if (under === 0 && !overflow) return null;

  const pieces = [
    under > 0 ? `${under} tile${under === 1 ? "" : "s"} under minimum` : null,
    overflow ? `${diagnosis.capacity.panes} tiles exceed capacity ${diagnosis.capacity.cap}` : null,
  ].filter(Boolean);
  const detail = diagnosis.fits
    ? `worst shortfall ${diagnosis.worstShortfallPx}px — a weight repair can fix this`
    : `needs ${diagnosis.need.w}×${diagnosis.need.h}, screen offers ${rect.w}×${rect.h}`;
  return (
    <Button
      size="tiny"
      variant="framed"
      className={styles.badge}
      data-part="rebalance-badge"
      title={`${detail} — open the rebalance dialog`}
      onClick={() => workbench.verbs.openRebalance()}
    >
      ⚠ {pieces.join(" · ")}
    </Button>
  );
}
