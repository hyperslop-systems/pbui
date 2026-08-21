import { Button, CheckboxRow, KindLegend, Surface, Text, Toolbar } from "@hyperslop-systems/pbui";
import { ChatProvider, selectOverlay, useChatClient, useChatSelector, type ChatProviderConfig } from "@go-go-golems/chat-provider";
import { useReferenceIndex } from "@hyperslop-systems/pbui-chat";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./App.module.css";
import { chat } from "./chat";
import { TONES, type Environment, type PresentationType } from "./pbui/types";
import { defaultLauncherRows, tileRefOf, type LauncherRow, type LauncherRowsContext } from "@hyperslop-systems/pbui-workbench";
import { PROGRAM_BINDING, useLibrary } from "@hyperslop-systems/pbui-sandbox";
import { library } from "./sandbox";
import { resetLayout, workbench } from "./workbench";

/*
 * Module-level so `ChatProvider`'s `useMemo` keyed on it runs once; a config
 * object built in render would recreate the client on every render.
 */
const chatConfig: ChatProviderConfig = {
  basePrefix: "",
  extensions: [chat.extension],
  sendMessageBody: chat.sendMessageBody,
  sessionPolicy: { restore: "url", parameter: "session", fallback: { restore: "local-storage", storageKey: "pbui-chat-demo.session" } },
};

const LEGEND_TYPES: PresentationType[] = ["product", "category", "metal", "order", "field", "row", "source", "widget", "tool", "proposal"];

const isApple = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);

export function App() {
  const [canApprove, setCanApprove] = useState(false);
  return (
    <ChatProvider config={chatConfig}>
      <Shell canApprove={canApprove} onCanApproveChange={setCanApprove} />
    </ChatProvider>
  );
}

function Shell({ canApprove, onCanApproveChange }: { canApprove: boolean; onCanApproveChange(next: boolean): void }) {
  const client = useChatClient();
  const overlay = useChatSelector(selectOverlay);
  const environment = useMemo<Environment>(
    () => ({ canApprove, sessionId: overlay.sessionId || null }),
    [canApprove, overlay.sessionId],
  );

  // Connect on load: restores the session named in the URL (or local
  // storage), hydrates the timeline, and re-parks pending human tools.
  useEffect(() => {
    void client.connect().catch(() => undefined);
  }, [client]);

  return (
    <chat.Provider environment={environment}>
      <div className={styles.shell}>
        <Surface as="section" tone="inverted" border="none" className={styles.masthead}>
          <Toolbar as="header" tight>
            <Text size="title" strong className={styles.wordmark}>
              GOLD COIN SHOP
            </Text>
            <Text size="tiny" tone="faint">
              · agent
            </Text>
            <span className={styles.spacer} />
            <Legend />
            <CheckboxRow checked={canApprove} onCheckedChange={onCanApproveChange} label="approver role" size="tiny" />
            <Button size="tiny" variant="framed" onClick={() => workbench.verbs.openLauncher()} title="open the launcher to place an application">
              {isApple ? "⌘K" : "Ctrl+K"} · launcher
            </Button>
            <Button size="tiny" onClick={resetLayout} title="back to the default tiles">
              reset layout
            </Button>
            <Text size="tiny" tone="faint">
              {overlay.wsStatus}
            </Text>
          </Toolbar>
        </Surface>

        <main className={styles.canvas}>
          <Workbench />
        </main>
      </div>
      <chat.ObjectMenu />
      <chat.AcceptBanner />
    </chat.Provider>
  );
}

/**
 * The tiles, and the launcher behind ⌘K.
 *
 * Each tile's title IS a `<tile>` presentation, so right-clicking the bar
 * offers the same split / show-something-else / rename / close verbs the bar
 * buttons perform — two doors, one set of verbs — with `disabledBecause`
 * recomputed from the tile's state on every render. The verbs come from
 * pbui-workbench's `createTileDescriptor`, so every product in the family
 * words them identically.
 */
const PROGRAM_ROW_PREFIX = "program:";

function Workbench() {
  const pbui = chat.pbui.usePbui();
  const shortcutContext = useCallback(
    () => ({ objectMenuOpen: pbui.menu !== null, acceptingPresentation: pbui.accepting !== null }),
    [pbui.menu, pbui.accepting],
  );
  // The launcher skips doc-bound applications on purpose (a program tile with
  // no program would open empty), so programs get rows of their own: one per
  // library entry, each opening the `script` app bound to it.
  const programs = useLibrary(library, (state) => state.programs);
  const rows = useCallback(
    (context: LauncherRowsContext): LauncherRow[] => [
      ...defaultLauncherRows(context),
      ...Object.values(programs)
        .filter((program) => context.query === "" || program.title.toLowerCase().includes(context.query))
        .map((program) => ({
          id: `${PROGRAM_ROW_PREFIX}${program.id}`,
          kind: "app" as const,
          appId: "script",
          title: program.title,
          detail: `program · v${program.version} · by ${program.by}${program.bindings.length ? ` · needs ${program.bindings.join(", ")}` : ""}`,
        })),
    ],
    [programs],
  );
  const choose = useCallback((row: LauncherRow, context: LauncherRowsContext): boolean => {
    if (!row.id.startsWith(PROGRAM_ROW_PREFIX)) return false;
    const near = context.invocation.target;
    workbench.verbs.openView("script", { [PROGRAM_BINDING]: row.id.slice(PROGRAM_ROW_PREFIX.length) }, near ? { near } : {});
    workbench.verbs.closeLauncher();
    return true;
  }, []);
  return (
    <>
      {/* The human door to workspace.select. The agent can create a workspace
          and switch to it; without this the user could not switch back. */}
      <workbench.WorkspaceStrip addLabel="workspace" />
      <workbench.Surface
        renderTitle={(_view, placement) => {
          const tile = tileRefOf(workbench, placement.placementId);
          if (!tile) return <Text size="tiny" strong>{placement.label}</Text>;
          return (
            <chat.pbui.Presentation
              reference={{ type: "tile", value: { type: "tile", id: tile.placementId, value: tile } }}
              doc={`tile showing ${tile.title}`}
              inComposite
            >
              <Text size="tiny" strong>
                {tile.title}
              </Text>
              {tile.placementCount > 1 ? (
                <Text size="tiny" tone="faint">
                  {` ×${tile.placementCount}`}
                </Text>
              ) : null}
            </chat.pbui.Presentation>
          );
        }}
      />
      <workbench.Launcher title="Place an application" shortcutContext={shortcutContext} rows={rows} choose={choose} />
    </>
  );
}

/** The tones in play, counted from the objects the agent has resolved so far. */
function Legend() {
  const index = useReferenceIndex();
  const counts = new Map<string, number>();
  for (const reference of index.values()) counts.set(reference.type, (counts.get(reference.type) ?? 0) + 1);
  return (
    <div className={styles.legend}>
      <KindLegend
        accessibleName="presentation types"
        kinds={LEGEND_TYPES.map((kind) => ({ kind, tone: TONES[kind], total: counts.get(kind) ?? 0, count: counts.get(kind) ?? 0 }))}
        format={(n) => String(n)}
      />
    </div>
  );
}
