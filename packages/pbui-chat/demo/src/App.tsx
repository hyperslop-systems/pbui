import { Button, CheckboxRow, Surface, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useConversations } from "@hyperslop-systems/pbui-chat";
import { useCallback, useMemo, useState } from "react";
import styles from "./App.module.css";
import { chat } from "./chat";
import { type Environment } from "./pbui/types";
import { defaultLauncherRows, tileRefOf, type LauncherRow, type LauncherRowsContext } from "@hyperslop-systems/pbui-workbench";
import { PROGRAM_BINDING, useLibrary } from "@hyperslop-systems/pbui-sandbox";
import { library } from "./sandbox";
import { resetLayout, workbench } from "./workbench";

const isApple = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);

/*
 * No `<ChatProvider>` here any more. `chat.Provider` hosts one per OPEN
 * conversation, so the shop can have several agents on screen at once; a chat
 * tile is a view of one of them (guide §4.5).
 */
export function App() {
  const [canApprove, setCanApprove] = useState(false);
  // The environment's `sessionId` is the ACTIVE conversation now: a descriptor
  // that shows "who is asking" follows the tile the user last clicked into,
  // the same way the sandbox devtools follow the selected sandbox.
  const activeId = useConversations(chat.conversations, (registry) => registry.activeId());
  const environment = useMemo<Environment>(() => ({ canApprove, sessionId: activeId }), [canApprove, activeId]);
  return (
    <chat.Provider environment={environment}>
      <Shell canApprove={canApprove} onCanApproveChange={setCanApprove} />
    </chat.Provider>
  );
}

function Shell({ canApprove, onCanApproveChange }: { canApprove: boolean; onCanApproveChange(next: boolean): void }) {
  // Nothing connects here any more: `chat.Provider` hosts a runtime per open
  // conversation and each one connects itself as it attaches.
  const active = useConversations(chat.conversations, (registry) => {
    const id = registry.activeId();
    return id ? registry.get(id) : null;
  });

  return (
    <>
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
            <CheckboxRow checked={canApprove} onCheckedChange={onCanApproveChange} label="approver role" size="tiny" />
            <Button size="tiny" variant="framed" onClick={() => workbench.verbs.openLauncher()} title="open the launcher to place an application">
              {isApple ? "⌘K" : "Ctrl+K"} · launcher
            </Button>
            <Button size="tiny" onClick={resetLayout} title="back to the default tiles">
              reset layout
            </Button>
            <Text size="tiny" tone="faint">
              {active ? active.wsStatus : "no conversation"}
            </Text>
          </Toolbar>
        </Surface>

        <main className={styles.canvas}>
          <Workbench />
        </main>
      </div>
      <chat.ObjectMenu />
      <chat.AcceptBanner />
    </>
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

