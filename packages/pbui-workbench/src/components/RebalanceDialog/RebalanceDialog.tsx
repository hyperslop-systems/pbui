import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, isEditableTarget, routeWorkbenchKey, useAnyEscapeSurface } from "@hyperslop-systems/pbui";
import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import { panesOf, toAnalysis, layoutBinary, type Rect } from "../../rebalance/analysisTree";
import type { RebalanceConfig } from "../../rebalance/config";
import { documentRebalanceConfigStore, type RebalanceConfigStore } from "../../rebalance/configStore";
import { TIERS } from "../../rebalance/measure";
import { buildSlate, type Proposal, type RebalanceSlate } from "../../rebalance/slate";
import type { RebalanceProps } from "../../types";
import { DEFAULT_DIVIDER_PX, type WorkbenchVerb } from "../../verbs";
import styles from "./RebalanceDialog.module.css";

/**
 * The rebalance dialog (PBUI-REBALANCE-1, design-doc/01 §4.1/§4.3): press
 * Mod+Shift+K and the workspace's repair proposals appear as cards ordered by
 * measured invasiveness, each a thumbnail of the proposed layout with ghost
 * outlines where tiles sit today. The layout is never repaired behind the
 * user's back — Apply is the only mutating path, it goes through the
 * workbench's atomic `plan`/`applyPlan`, and a single-level Undo restores the
 * pre-apply document while the dialog stays open.
 *
 * Escape and focus return belong to the wrapped `Dialog`; this component
 * deliberately does NOT register an escape surface of its own (surfaces.ts:
 * one surface, one registration).
 */
export function WorkbenchRebalance({ shortcut = true, shortcutContext, config, configStore }: RebalanceProps) {
  const workbench = useWorkbench();
  const open = workbench.useWorkbenchState((state) => state.rebalanceOpen);
  const anySurfaceOpen = useAnyEscapeSurface();

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const root = workbench.root();
      if (!root) return;
      // Same ownership rule as the Launcher: the workbench containing focus
      // reacts; with focus on <body>, a lone workbench reacts.
      const focused = document.activeElement;
      const unowned = !focused || focused === document.body;
      const ownsFocus = !unowned && root.contains(focused);
      const lone = document.querySelectorAll("[data-workbench-shell]").length === 1;
      if (!ownsFocus && !(unowned && lone)) return;
      const extra = shortcutContext?.() ?? {};
      const decision = routeWorkbenchKey(
        event,
        {
          targetIsEditable: isEditableTarget(event.target as HTMLElement | null),
          launcherOpen: workbench.store.getState().launcherOpen,
          dialogOpen: anySurfaceOpen,
          objectMenuOpen: extra.objectMenuOpen ?? false,
          acceptingPresentation: extra.acceptingPresentation ?? false,
          renamingView: extra.renamingView ?? false,
        },
        navigator.platform,
      );
      if (decision.kind !== "open-rebalance") return;
      event.preventDefault();
      workbench.verbs.openRebalance();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shortcut, shortcutContext, anySurfaceOpen, workbench]);

  return open ? <RebalanceModal config={config} configStore={configStore} /> : null;
}

/** Headless/story fallback when the Surface has no measurable box yet. */
const FALLBACK_RECT: Rect = { x: 0, y: 0, w: 1024, h: 640 };

function measureRect(element: HTMLElement | null): Rect {
  const box = element?.getBoundingClientRect();
  if (!box || !Number.isFinite(box.width) || box.width <= 8 || box.height <= 8) return FALLBACK_RECT;
  return { x: 0, y: 0, w: Math.round(box.width), h: Math.round(box.height) };
}

export function measureDividerPx(element: HTMLElement | null): number {
  const rendered = element?.querySelector<HTMLElement>('[data-part="split-divider"]');
  if (rendered) {
    // The track's THICKNESS is its smaller dimension: a row divider is tall
    // and ~10px wide, a column divider is wide and ~10px tall. Reading
    // `.width` unconditionally once measured a column divider's full ~700px
    // span as the gap, inflating every propagation number and clumping the
    // thumbnails (PBUI-REBALANCE-1 diary step 7).
    const box = rendered.getBoundingClientRect();
    const thickness = Math.min(box.width, box.height);
    if (Number.isFinite(thickness) && thickness > 0) return thickness;
  }
  if (element && typeof getComputedStyle === "function") {
    const token = Number.parseFloat(getComputedStyle(element).getPropertyValue("--pbui-space-4"));
    if (Number.isFinite(token) && token > 0) return token;
  }
  return DEFAULT_DIVIDER_PX;
}

function tileLabels(doc: WorkbenchDocument, workspaceId: string, appTitle: (appId: string) => string | null): Map<string, string> {
  const labels = new Map<string, string>();
  const tree = workspaceTree(doc, workspaceId);
  if (!tree) return labels;
  const walk = (node: typeof tree): void => {
    if (node.body.case === "leaf") {
      const view = doc.views[node.body.value.viewId];
      labels.set(node.id, view?.title ?? (view ? (appTitle(view.appId) ?? view.appId) : node.body.value.viewId));
    } else if (node.body.case === "split") {
      if (node.body.value.a) walk(node.body.value.a);
      if (node.body.value.b) walk(node.body.value.b);
    }
  };
  walk(tree);
  return labels;
}

/** Remounted per opening, so selection and undo state start fresh. */
function RebalanceModal({ config: configProp, configStore }: { config?: RebalanceConfig; configStore?: RebalanceConfigStore }) {
  const workbench = useWorkbench();
  const doc = workbench.useDocument();
  // The store hook runs unconditionally (rules of hooks — keep the store
  // identity stable); an explicit `config` prop then wins over it. Default
  // store: the `pbui.rebalance-config` payload in the workbench document.
  const storedConfig = (configStore ?? documentRebalanceConfigStore).useConfig(workbench);
  const config = configProp ?? storedConfig;
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);
  const [rect, setRect] = useState<Rect>(() => measureRect(workbench.root()));
  const [status, setStatus] = useState<string | null>(null);
  const undoRef = useRef<WorkbenchDocument | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const element = workbench.root();
    if (!element || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => setRect(measureRect(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [workbench]);

  const tree = workspaceTree(doc, workspaceId);
  const slate: RebalanceSlate | null = useMemo(() => {
    if (!tree) return null;
    const dividerPx = measureDividerPx(workbench.root());
    const labels = tileLabels(doc, workspaceId, (appId) => workbench.apps.get(appId)?.title ?? null);
    return buildSlate({ tree, rect, dividerPx, labels }, config);
    // doc identity covers tree identity; rect is state.
  }, [doc, workspaceId, rect, config, workbench, tree]);

  const proposals = slate?.proposals ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    proposals.find((p) => p.id === selectedId) ?? proposals.find((p) => p.recommended) ?? proposals[0] ?? null;

  const close = () => workbench.verbs.closeRebalance();

  /**
   * Apply a proposal. `close: true` (the default gesture — a plain click on a
   * card, or the Apply + close button) commits and dismisses the dialog;
   * `close: false` (Shift+click, or the plain Apply button) keeps it open so
   * the result can be inspected, compared, and undone.
   */
  const apply = (proposal: Proposal | null, options: { close: boolean }) => {
    if (!proposal) return;
    if (proposal.apply.kind === "none") {
      if (options.close) {
        close();
        return;
      }
      setStatus(proposal.baseline ? "Kept the layout as it is." : "This proposal has nothing to apply.");
      return;
    }
    const verbs: WorkbenchVerb[] =
      proposal.apply.kind === "resize-batch"
        ? proposal.apply.verbs
        : [{ kind: "workspace.setTree", workspaceId, tree: proposal.apply.tree }];
    const planned = workbench.plan(verbs);
    if (!planned.ok) {
      setStatus(`Refused: ${planned.error}`);
      return;
    }
    const before = workbench.store.getState().document;
    if (!workbench.applyPlan(planned.plan)) {
      // The document moved between plan and apply; the slate recomputes from
      // the store subscription, so just say what happened.
      setStatus("The layout changed underneath — proposals recomputed.");
      return;
    }
    if (options.close) {
      close();
      return;
    }
    undoRef.current = before;
    setCanUndo(true);
    setStatus(`Applied ${proposal.agrees[0]} — ${TIERS[proposal.tier].name}, ${proposal.stats.moved}/${proposal.stats.panes} tiles, ${proposal.stats.disp}px. Undo restores the previous layout.`);
  };

  const undo = () => {
    const previous = undoRef.current;
    if (!previous) return;
    undoRef.current = null;
    setCanUndo(false);
    workbench.store.replaceDocument(previous);
    setStatus("Restored the previous layout.");
  };

  const move = (delta: number) => {
    if (!selected) return;
    const index = proposals.indexOf(selected);
    const next = proposals[Math.max(0, Math.min(proposals.length - 1, index + delta))];
    if (next) setSelectedId(next.id);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      move(-1);
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      move(1);
      event.preventDefault();
    } else if (event.key.toLowerCase() === "u" && canUndo) {
      undo();
      event.preventDefault();
    }
  };

  const diagnosis = slate?.diagnosis;
  return (
    <Dialog
      title="Rebalance workspace"
      onClose={close}
      footer={
        <div className={styles.footer} data-part="rebalance-footer">
          <Button variant="raised" onClick={() => apply(selected, { close: true })} disabled={!selected}>
            Apply + close
          </Button>
          <Button
            variant="framed"
            onClick={() => apply(selected, { close: false })}
            disabled={!selected || selected.apply.kind === "none"}
          >
            Apply
          </Button>
          <Button variant="bare" onClick={undo} disabled={!canUndo}>
            Undo
          </Button>
          <span className={styles.hint}>click a card applies + closes · ⇧click keeps the dialog open · ←/→ select · Esc closes</span>
        </div>
      }
    >
      <div className={styles.body} data-part="rebalance" onKeyDown={onKeyDown}>
        {diagnosis ? (
          <div className={styles.diagnosis} data-part="rebalance-diagnosis">
            {diagnosis.violations.length === 0 ? (
              <span className={styles.ok}>every tile clears its minimum</span>
            ) : (
              <span className={styles.badText}>
                {diagnosis.violations.length} tile{diagnosis.violations.length > 1 ? "s" : ""} under minimum · worst
                shortfall {diagnosis.worstShortfallPx}px
              </span>
            )}
            <span>
              · needs {Math.round(diagnosis.need.w)}×{Math.round(diagnosis.need.h)}{" "}
              {diagnosis.fits ? <span className={styles.ok}>fits</span> : <span className={styles.badText}>exceeds the workspace</span>}
            </span>
            {diagnosis.capacity.overflow ? (
              <span className={styles.badText}>
                {" "}
                · only {diagnosis.capacity.cap} tiles fit at these minimums — close something or lower the floor
              </span>
            ) : null}
          </div>
        ) : (
          <div className={styles.diagnosis}>no workspace to rebalance</div>
        )}
        <div className={styles.strip} role="listbox" aria-label="layout proposals" tabIndex={0} data-part="rebalance-cards">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              selected={proposal === selected}
              config={config}
              onActivate={(event) => {
                setSelectedId(proposal.id);
                // The default gesture commits and dismisses; Shift holds the
                // dialog open for the inspect / compare / undo loop.
                apply(proposal, { close: !event.shiftKey });
              }}
            />
          ))}
        </div>
        {status ? (
          <div className={styles.status} data-part="rebalance-status" role="status">
            {status}
          </div>
        ) : null}
        {selected && selected.trace.length > 0 ? (
          <details className={styles.trace} data-part="rebalance-trace">
            <summary>trace · {selected.agrees[0]}</summary>
            <div className={styles.traceLines}>
              {selected.trace.slice(0, 200).map((line, index) => (
                <div key={index} className={line.c === "red" ? styles.badText : line.c === "grn" ? styles.ok : undefined}>
                  {line.t}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </Dialog>
  );
}

function ProposalCard({
  proposal,
  selected,
  config,
  onActivate,
}: {
  proposal: Proposal;
  selected: boolean;
  config: RebalanceConfig;
  onActivate(event: React.MouseEvent): void;
}) {
  const out = !proposal.policy.ok;
  return (
    <div
      role="option"
      aria-selected={selected}
      id={`rebalance:${proposal.id}`}
      data-part="rebalance-card"
      className={[styles.card, selected ? styles.cardSelected : "", out ? styles.cardOut : ""].filter(Boolean).join(" ")}
      onClick={onActivate}
      title={`${TIERS[proposal.tier].name} · ${proposal.agrees.join(", ")} · click applies + closes, ⇧click keeps the dialog open`}
    >
      <div className={styles.cardHead}>
        <span className={styles.tierChip}>{TIERS[proposal.tier].chip}</span>
        <span className={styles.cardTitle}>{proposal.label}</span>
        <span className={styles.cardNote}>
          {proposal.agrees.length > 1 ? `+${proposal.agrees.length - 1} agree` : proposal.note}
        </span>
        {proposal.recommended ? <span className={styles.pick}>PICK</span> : null}
      </div>
      <Thumbnail proposal={proposal} config={config} />
      <div className={styles.cardWhy}>
        {proposal.why}
        {out ? <span className={styles.badText}> · outside policy: {proposal.policy.reason}</span> : null}
      </div>
      <div className={styles.cardNums}>
        {proposal.stats.viol > 0 ? (
          <span className={styles.badText}>{proposal.stats.viol} bad</span>
        ) : (
          <span className={styles.ok}>all fit</span>
        )}
        <span>
          {proposal.stats.moved}/{proposal.stats.panes} tiles · {proposal.stats.disp}px
        </span>
      </div>
    </div>
  );
}

/** Only the biggest movers get a ghost + trail — past four the thumbnail turns into spaghetti. */
const MAX_TRAILS = 4;
const THUMB_W = 168;
const HUES = 7;

/**
 * The proposal's geometry, scaled into a small SVG: identity hue per tile
 * (stable across every card, keyed by reading order), a danger stroke on
 * tiles still under minimum, and dashed ghosts + trails from where the
 * biggest movers sit today to where the proposal puts them.
 */
function Thumbnail({ proposal, config }: { proposal: Proposal; config: RebalanceConfig }) {
  const workbench = useWorkbench();
  const doc = workbench.useDocument();
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);
  const order = useMemo(() => {
    const tree = workspaceTree(doc, workspaceId);
    if (!tree) return [] as string[];
    // Reading order of the CURRENT tree fixes each tile's hue for all cards.
    const rects = layoutBinary(tree, FALLBACK_RECT, DEFAULT_DIVIDER_PX);
    return panesOf(toAnalysis(tree, rects, {})).map((p) => p.id);
  }, [doc, workspaceId]);

  const entries = order
    .map((id, index) => ({ id, index, rect: proposal.rects.get(id), before: undefined as Rect | undefined }))
    .filter((entry) => entry.rect);
  if (entries.length === 0) return null;
  const bounds = entries.reduce(
    (acc, { rect }) => ({
      w: Math.max(acc.w, (rect as Rect).x + (rect as Rect).w),
      h: Math.max(acc.h, (rect as Rect).y + (rect as Rect).h),
    }),
    { w: 1, h: 1 },
  );
  const scale = THUMB_W / bounds.w;
  const height = Math.max(40, Math.round(bounds.h * scale));
  const beforeOf = (id: string) => (proposal.baseline ? undefined : thumbBefore(proposal, id));
  const movers = proposal.baseline
    ? new Set<string>()
    : new Set(
        entries
          .map(({ id, rect }) => {
            const before = beforeOf(id);
            if (!before || !rect) return null;
            const d =
              Math.abs(before.x - rect.x) + Math.abs(before.y - rect.y) + Math.abs(before.w - rect.w) + Math.abs(before.h - rect.h);
            return d > 2 ? { id, d } : null;
          })
          .filter((entry): entry is { id: string; d: number } => entry !== null)
          .sort((a, b) => b.d - a.d)
          .slice(0, MAX_TRAILS)
          .map((entry) => entry.id),
      );
  return (
    <svg
      className={styles.thumb}
      viewBox={`0 0 ${THUMB_W} ${height}`}
      role="img"
      aria-label={`proposed layout: ${proposal.agrees[0]}`}
    >
      {entries.map(({ id, index, rect }) => {
        const r = rect as Rect;
        const bad = r.w < config.minInlinePx - 0.5 || r.h < config.minBlockPx - 0.5;
        return (
          <rect
            key={id}
            x={(r.x * scale).toFixed(1)}
            y={(r.y * scale).toFixed(1)}
            width={Math.max(1, r.w * scale).toFixed(1)}
            height={Math.max(1, r.h * scale).toFixed(1)}
            className={[styles[`fill${index % HUES}`], bad ? styles.thumbBad : ""].filter(Boolean).join(" ")}
          />
        );
      })}
      {entries.map(({ id, index, rect }) => {
        if (!movers.has(id)) return null;
        const before = beforeOf(id);
        const r = rect as Rect;
        if (!before) return null;
        return (
          <g key={`ghost-${id}`} className={styles[`stroke${index % HUES}`]}>
            <rect
              className={styles.ghost}
              x={(before.x * scale).toFixed(1)}
              y={(before.y * scale).toFixed(1)}
              width={Math.max(1, before.w * scale).toFixed(1)}
              height={Math.max(1, before.h * scale).toFixed(1)}
            />
            <line
              className={styles.trail}
              x1={((before.x + before.w / 2) * scale).toFixed(1)}
              y1={((before.y + before.h / 2) * scale).toFixed(1)}
              x2={((r.x + r.w / 2) * scale).toFixed(1)}
              y2={((r.y + r.h / 2) * scale).toFixed(1)}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** The tile's CURRENT rect, from the slate's before-map stashed on the proposal list. */
function thumbBefore(proposal: Proposal, id: string): Rect | undefined {
  return proposal.beforeRects?.get(id);
}
