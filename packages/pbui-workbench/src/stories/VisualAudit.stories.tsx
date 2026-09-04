import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Button, Stack, Text, terms, linkVerbs, createPresentationTypeGraph, type Badge, type BadgeState } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../createWorkbenchShell";
import { commands, layout, split, tile, linksMutation } from "@hyperslop-systems/workbench-core";
import { defineWorkbenchApp, type AppProps } from "../app";
import { usePort } from "../links/hooks";
import { PortBadge } from "../components/PortBadge";
import { demoApps, counterApp } from "./demoApps";
import { coordinationInspectorApp } from "../components/CoordinationInspector";
import { rebalanceSettingsApp } from "../components/RebalanceSettings";
import { RebalanceStatusBadge } from "../components/RebalanceBadge";
import { WorkbenchContext } from "../context";

/**
 * VISUAL AUDIT (PBUI-VISUAL-1): every workbench + tile-linking state worth
 * comparing side by side, laid out with labels, for a visual-consistency
 * pass across the pbui packages and demos. Nothing here changes behaviour —
 * it only arranges states that already exist elsewhere (component stories,
 * the labs) so a reviewer can see them in one screenshot instead of
 * clicking through many.
 */

const meta: Meta = { title: "Visual Audit", parameters: { layout: "fullscreen" } };
export default meta;

// ---------------------------------------------------------------------------
// shared chrome: a labelled panel and a page grid
// ---------------------------------------------------------------------------

function Panel({ label, note, width, height = 260, children }: { label: string; note?: string; width?: number | string; height?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", gap: 4, width, minWidth: 0 }}>
      <Text size="small" strong>
        {label}
      </Text>
      {note ? (
        <Text size="tiny" tone="faint">
          {note}
        </Text>
      ) : (
        <span />
      )}
      <div style={{ height, minHeight: 0, border: "1px solid #999", borderRadius: 4, overflow: "hidden", position: "relative" }}>{children}</div>
    </div>
  );
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, display: "grid", gap: 8, fontFamily: "sans-serif" }}>
      <Text size="title" strong>
        {title}
      </Text>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>{children}</div>
    </div>
  );
}

function firstTwoViews(wb: ReturnType<typeof createWorkbench>) {
  return leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
}

// ---------------------------------------------------------------------------
// PortBadge: every state
// ---------------------------------------------------------------------------

const badge = (state: BadgeState, glyph: string, text: string, explanation: string): Badge => ({
  port: "v-1/order",
  name: "order",
  state,
  glyph,
  text,
  explanation,
  binding: terms.ambient("workspace.order"),
  evaluation: { kind: "empty", provenance: terms.ambient("workspace.order"), path: ["v-1/order"] },
});

const ALL_BADGES: Badge[] = [
  badge("ambient", "○", "order · order", "order reads the workspace.order context, now order 1042"),
  badge("empty", "○", "order · none", "order reads the workspace.order context, which is empty"),
  badge("following", "→", "Orders East", "order follows Orders East, now order 1042"),
  badge("held", "⏸", "order 1042", "order is held on order 1042; resume follows Orders East"),
  badge("fixed", "•", "order 1042", "order is fixed on order 1042"),
  badge("shared", "≡", "selection · σ2", "selection shares the σ2 cell"),
  badge("derived", "←", "customer ← order.customer", "customer derives through order.customer from Orders East"),
  badge("unresolved", "⚠", "order", "order: the source tile was closed"),
];

export const PortBadgeGallery: StoryObj = {
  name: "PortBadge — every state, as it sits after a tile title",
  render: () => (
    <Page title="PortBadge — every state">
      <div style={{ display: "grid", gap: 10, padding: 12, fontFamily: "monospace", fontSize: 13, border: "1px solid #999", borderRadius: 4 }}>
        {ALL_BADGES.map((b) => (
          <div key={b.state} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 130, display: "inline-block" }}>ORDER DETAIL</span>
            <PortBadge badge={b} />
            <span style={{ opacity: 0.5, marginLeft: 12 }}>{b.state}</span>
          </div>
        ))}
      </div>
    </Page>
  ),
};

// ---------------------------------------------------------------------------
// PortRail: 0 / 1 / many ports, in connect mode
// ---------------------------------------------------------------------------

const noPortApp = defineWorkbenchApp({
  manifest: { id: "no-ports", ports: [] },
  presentation: {
    title: "no ports",
    tone: "var(--pbui-cat-1)",
    Component: () => (
      <div data-part="no-ports-app">
        <Text size="small">this application declares no ports</Text>
      </div>
    ),
  },
});

function ManyPortsApp({ view }: AppProps) {
  const a = usePort(view, "a");
  const b = usePort(view, "b");
  return (
    <div data-part="many-ports-app">
      <Stack gap={2}>
        <Text size="small">four ports: alpha/beta in, gamma/delta out</Text>
        <Text size="tiny" tone="faint">
          alpha: {a.badge.state} · beta: {b.badge.state}
        </Text>
      </Stack>
    </div>
  );
}

const manyPortsApp = defineWorkbenchApp({
  manifest: {
    id: "many-ports",
    ports: [
      { name: "alpha", direction: "in", contract: "any", doc: "first input" },
      { name: "beta", direction: "in", contract: "any", doc: "second input" },
      { name: "gamma", direction: "out", contract: "any", doc: "first output" },
      { name: "delta", direction: "out", contract: "any", doc: "second output" },
    ],
  },
  presentation: { title: "many ports", tone: "var(--pbui-cat-2)", Component: ManyPortsApp },
});

function ConnectModeRail({ appId, linked }: { appId: string; linked?: boolean }) {
  const wb = useMemo(() => {
    const workbench = createWorkbench({ apps: [...demoApps, noPortApp, manyPortsApp], initial: layout(split("row", 0.5, tile(appId), tile("counter"))) });
    if (linked) {
      const [a] = firstTwoViews(workbench);
      if (a) workbench.perform(linkVerbs.follow(`${a}/count`, `${a}/alpha`));
    }
    workbench.perform(linkVerbs.openMode());
    return workbench;
  }, [appId, linked]);
  return <wb.Surface />;
}

export const PortRailCounts: StoryObj = {
  name: "PortRail — 0 / 1 / many ports, connect mode",
  render: () => (
    <Page title="PortRail — port count variety (back side of a tile in connect mode)">
      <Panel label="0 ports" note="no-ports app: rail shows “no inputs” / “no outputs”">
        <ConnectModeRail appId="no-ports" />
      </Panel>
      <Panel label="1 port (out)" note="counter: one out port, unbound">
        <ConnectModeRail appId="counter" />
      </Panel>
      <Panel label="1 port (in)" note="notes: one in port, unbound">
        <ConnectModeRail appId="notes" />
      </Panel>
      <Panel label="many ports" note="4 ports (2 in / 2 out), unbound">
        <ConnectModeRail appId="many-ports" />
      </Panel>
      <Panel label="many ports, one bound" note="alpha now follows a counter's count">
        <ConnectModeRail appId="many-ports" linked />
      </Panel>
    </Page>
  ),
};

// ---------------------------------------------------------------------------
// Tile: header variants
// ---------------------------------------------------------------------------

function NestedTileApp() {
  const inner = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) }), []);
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", padding: 4, gap: 4 }}>
      <Text size="tiny" tone="faint">
        a workbench Surface embedded inside another tile's application slot
      </Text>
      <div style={{ minHeight: 0, border: "1px dashed #999", borderRadius: 3 }}>
        <inner.Surface />
      </div>
    </div>
  );
}

const nestedTileApp = defineWorkbenchApp({
  manifest: { id: "nested-tile", ports: [] },
  presentation: { title: "nested workbench", tone: "var(--pbui-cat-4)", Component: NestedTileApp },
});

function PlainTile() {
  const wb = useMemo(() => createWorkbench({ apps: [counterApp], initial: layout(tile("counter")) }), []);
  return <wb.Surface />;
}

function BadgedTile() {
  const wb = useMemo(() => {
    const workbench = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const [a, notes] = firstTwoViews(workbench);
    if (a && notes) workbench.perform(linkVerbs.follow(`${a}/count`, `${notes}/subject`));
    return workbench;
  }, []);
  return <wb.Surface />;
}

function ActionTile() {
  const wb = useMemo(() => createWorkbench({ apps: [counterApp], initial: layout(tile("counter")) }), []);
  return (
    <wb.Surface
      tileAction={() => (
        <div style={{ display: "flex", gap: 4 }}>
          <Button size="tiny" variant="framed">
            custom
          </Button>
        </div>
      )}
    />
  );
}

function ActiveTile() {
  const wb = useMemo(() => {
    const workbench = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const [, notes] = firstTwoViews(workbench);
    if (notes) workbench.execute(commands.activate(notes));
    return workbench;
  }, []);
  return <wb.Surface />;
}

export const TileHeaderVariants: StoryObj = {
  name: "Tile — header variants",
  render: () => (
    <Page title="Tile — header variants">
      <Panel label="no ports / no badges" note="plain header, no PortBadge">
        <PlainTile />
      </Panel>
      <Panel label="with a badge" note="notes.subject follows the counter">
        <BadgedTile />
      </Panel>
      <Panel label="with a custom action" note="tileAction replaces the ⌕ icon button">
        <ActionTile />
      </Panel>
      <Panel label="selected / active" note="the second tile (notes) is the active placement">
        <ActiveTile />
      </Panel>
      <Panel label="nested tile-in-tile" note="a full workbench Surface inside one tile's app slot" width={420}>
        <div style={{ height: "100%" }}>
          {(() => {
            const wb = createWorkbench({ apps: [nestedTileApp], initial: layout(tile("nested-tile")) });
            return <wb.Surface />;
          })()}
        </div>
      </Panel>
    </Page>
  ),
};

// ---------------------------------------------------------------------------
// Surface: layout variety
// ---------------------------------------------------------------------------

function SurfaceOf({ spec }: { spec: Parameters<typeof layout>[0] }) {
  const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(spec) }), [spec]);
  return <wb.Surface />;
}

export const SurfaceVariants: StoryObj = {
  name: "Surface — single tile / split / nested split",
  render: () => (
    <Page title="Surface — layout variety">
      <Panel label="single tile" width={260}>
        <SurfaceOf spec={tile("counter")} />
      </Panel>
      <Panel label="one split" width={340}>
        <SurfaceOf spec={split("row", 0.5, tile("counter"), tile("notes"))} />
      </Panel>
      <Panel label="nested split" width={420}>
        <SurfaceOf spec={split("col", 0.5, split("row", 0.5, tile("counter"), tile("counter")), tile("notes"))} />
      </Panel>
    </Page>
  ),
};

// ---------------------------------------------------------------------------
// SplitPane: with tiles (nested, resizable dividers)
// ---------------------------------------------------------------------------

export const SplitPaneNested: StoryObj = {
  name: "SplitPane — nested, each divider independently resizable",
  render: function SplitPaneNestedStory() {
    const wb = useMemo(
      () =>
        createWorkbench({
          apps: demoApps,
          initial: layout(split("col", 0.5, split("row", 0.25, tile("counter"), tile("counter")), split("row", 0.75, tile("notes"), tile("counter")))),
        }),
      [],
    );
    return (
      <Page title="SplitPane — nested">
        <Panel label="four tiles, three dividers" width={640} height={420}>
          <wb.Surface />
        </Panel>
      </Page>
    );
  },
};

// ---------------------------------------------------------------------------
// WireLayer: follow, held (suspended), derived, identity (double wire)
// ---------------------------------------------------------------------------

export const WireLayerStyles: StoryObj = {
  name: "WireLayer — follow, held (dotted), derived (dashed + label), identity (double)",
  render: function WireLayerStory() {
    const wb = useMemo(() => {
      const workbench = createWorkbench({
        apps: demoApps,
        initial: layout(split("row", 0.34, tile("counter", { title: "Counter A" }), split("row", 0.5, tile("notes"), tile("counter", { title: "Counter B" })))),
      });
      const ids = leaves(workspaceTree(workbench.core.getState().document, workbench.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
      const [i1, i2, i3] = ids;
      if (i1 && i2 && i3) {
        workbench.apply([
          linksMutation({
            bindings: new Map([
              [`${i2}/subject`, terms.hold({ type: "number", value: 3 }, terms.follow(`${i1}/count`, "L1"))],
              [`${i3}/count`, terms.derived(terms.follow(`${i1}/count`, "L2"), "double", "L2")],
            ]),
            identity: [],
            classes: [],
            history: new Map(),
          }),
        ]);
      }
      workbench.perform(linkVerbs.openMode());
      return workbench;
    }, []);
    return (
      <Page title="WireLayer — wire styles">
        <Panel label="held (dotted) + derived (dashed, labelled)" width={720} height={460}>
          <wb.Surface />
        </Panel>
      </Page>
    );
  },
};

// ---------------------------------------------------------------------------
// LinkAnnouncer: a few messages, made visible (normally an sr-only live region)
// ---------------------------------------------------------------------------

export const LinkAnnouncerMessages: StoryObj = {
  name: "LinkAnnouncer — a few coordination messages, made visible",
  render: function LinkAnnouncerStory() {
    const wb = useMemo(() => {
      const workbench = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter", { title: "Counter A" }), tile("notes"))) });
      const [a, notes] = firstTwoViews(workbench);
      if (a && notes) {
        workbench.perform(linkVerbs.follow(`${a}/count`, `${notes}/subject`));
        workbench.perform(linkVerbs.pin(`${notes}/subject`));
      }
      return workbench;
    }, []);
    return (
      <Page title="LinkAnnouncer — visible live region">
        <Panel label="announcer text, forced visible" width={520} height={140}>
          <style>{`[data-part="link-announcer"] { position: static !important; width: auto !important; height: auto !important; clip: auto !important; clip-path: none !important; white-space: normal !important; padding: 6px 8px; border-top: 1px solid currentColor; font-size: 12px; display: block; }`}</style>
          <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", height: "100%" }}>
            <wb.Surface />
          </div>
        </Panel>
      </Page>
    );
  },
};

// ---------------------------------------------------------------------------
// RelationPalette / ShowChooser / RebalanceDialog / CoordinationInspector
// ---------------------------------------------------------------------------

export const RelationPaletteOpen: StoryObj = {
  name: "RelationPalette — open, two relations offered",
  render: function RelationPaletteStory() {
    const wb = useMemo(() => {
      const workbench = createWorkbench({
        apps: demoApps,
        initial: layout(split("row", 0.5, tile("counter", { title: "Counter A" }), tile("notes"))),
        links: {
          graph: createPresentationTypeGraph([{ id: "number" }, { id: "string" }]),
          relations: [
            { id: "number.double", from: "number", to: "any", label: "doubled" },
            { id: "number.label", from: "number", to: "any", label: "as a label" },
          ],
          relationEvaluation: (id, reference) => ({
            kind: "value",
            reference: id === "number.double" ? { type: "number", value: Number(reference.value) * 2 } : { type: "string", value: `count ${String(reference.value)}` },
          }),
        },
      });
      const [, notes] = firstTwoViews(workbench);
      if (notes) workbench.perform(linkVerbs.openPalette(`${notes}/subject`));
      return workbench;
    }, []);
    return (
      <Page title="RelationPalette — open">
        <Panel label="notes.subject: two relations from the counter's count" width={520} height={420}>
          <wb.Surface />
        </Panel>
      </Page>
    );
  },
};

export const ShowChooserOpen: StoryObj = {
  name: "ShowChooser — a show with no clear target",
  render: function ShowChooserStory() {
    const wb = useMemo(() => {
      const workbench = createWorkbench({
        apps: demoApps,
        initial: layout(split("row", 0.4, tile("counter", { title: "Counter A" }), split("col", 0.5, tile("counter", { title: "Counter B" }), tile("counter", { title: "Counter C" })))),
      });
      const [a] = firstTwoViews(workbench);
      if (a) workbench.links.runtime.emit(`${a}/count`, { type: "number", value: 7 });
      workbench.perform(linkVerbs.show({ type: "number", value: 7 }, { from: `${a}/count` }));
      return workbench;
    }, []);
    return (
      <Page title="ShowChooser — open">
        <Panel label="the chooser offers the spawnable notes tile" width={560} height={440}>
          <wb.Surface />
        </Panel>
      </Page>
    );
  },
};

export const RebalanceDialogOpen: StoryObj = {
  name: "RebalanceDialog — open over a degenerate layout",
  render: function RebalanceDialogStory() {
    const wb = useMemo(() => {
      const workbench = createWorkbench({
        apps: demoApps,
        initial: layout(split("row", 0.92, tile("counter"), split("col", 0.85, tile("notes"), tile("counter")))),
      });
      workbench.dispatch({ kind: "rebalance.open" });
      return workbench;
    }, []);
    return (
      <Page title="RebalanceDialog — open">
        <Panel label="sliver-and-hog layout, dialog open" width={560} height={440}>
          <wb.Surface />
          <wb.Rebalance />
        </Panel>
      </Page>
    );
  },
};

export const CoordinationInspectorContent: StoryObj = {
  name: "CoordinationInspector — ports, wires, contexts, invariants",
  render: function CoordinationInspectorStory() {
    const wb = useMemo(() => {
      const workbench = createWorkbench({
        apps: [...demoApps, coordinationInspectorApp],
        initial: layout(split("row", 0.5, split("col", 0.5, tile("counter", { title: "Counter A" }), tile("notes")), tile("coordination"))),
      });
      const [counter, notes] = firstTwoViews(workbench);
      if (counter && notes) {
        workbench.perform(linkVerbs.follow(`${counter}/count`, `${notes}/subject`));
        workbench.links.runtime.emit(`${counter}/count`, { type: "number", value: 4 });
      }
      return workbench;
    }, []);
    return (
      <Page title="CoordinationInspector — content">
        <Panel label="linked pair + inspector tile" width={700} height={440}>
          <wb.Surface />
        </Panel>
      </Page>
    );
  },
};

// ---------------------------------------------------------------------------
// RebalanceSettings + RebalanceBadge, for completeness with the dialog above
// ---------------------------------------------------------------------------

function BadgeHost({ ratio }: { ratio: number }) {
  const wb = useMemo(() => createWorkbench({ apps: demoApps, initial: layout(split("row", ratio, tile("counter"), tile("notes"))) }), [ratio]);
  return (
    <WorkbenchContext.Provider value={wb}>
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", height: "100%" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 4, borderBottom: "1px solid #ccc" }}>
          <Text size="tiny">status bar …</Text>
          <RebalanceStatusBadge />
        </div>
        <wb.Surface />
        <wb.Rebalance shortcut={false} />
      </div>
    </WorkbenchContext.Provider>
  );
}

export const RebalanceSettingsAndBadge: StoryObj = {
  name: "RebalanceSettings tile + RebalanceBadge, healthy vs broken",
  render: function RebalanceSettingsStory() {
    const settings = useMemo(() => createWorkbench({ apps: [...demoApps, rebalanceSettingsApp], initial: layout(split("row", 0.5, tile("counter"), tile("rebalance-settings"))) }), []);
    return (
      <Page title="RebalanceSettings + RebalanceBadge">
        <Panel label="settings tile beside a working tile" width={480} height={360}>
          <settings.Surface />
          <settings.Rebalance />
        </Panel>
        <Panel label="status badge: healthy (50/50)" width={320} height={220}>
          <BadgeHost ratio={0.5} />
        </Panel>
        <Panel label="status badge: broken (95/5 sliver)" width={320} height={220}>
          <BadgeHost ratio={0.95} />
        </Panel>
      </Page>
    );
  },
};
