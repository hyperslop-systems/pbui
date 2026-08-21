import { Button, CheckboxRow, Surface, Text, Toolbar } from "@hyperslop-systems/pbui";
import { RefPresentation, useConversations } from "@hyperslop-systems/pbui-chat";
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
            <Button
              size="tiny"
              variant="framed"
              onClick={() => void chat.router.perform({ kind: "conversation.new" })}
              title="start another agent and open it in a tile"
            >
              + conversation
            </Button>
            <Button size="tiny" variant="framed" onClick={() => workbench.verbs.openLauncher()} title="open the launcher to place an application">
              {isApple ? "⌘K" : "Ctrl+K"} · launcher
            </Button>
            <Button size="tiny" onClick={resetLayout} title="back to the default tiles">
              reset layout
            </Button>
          </Toolbar>
        </Surface>

        <main className={styles.canvas}>
          <Workbench />
        </main>

        {/* One status bar for the whole page: what the pointer is over, what
            L and R will do to it, and which conversation is active. */}
        <div className={styles.status}>
          <chat.MouseDocLine
            ambient={active ? `${active.title} · ${active.id.slice(0, 8)} · ${active.wsStatus}` : "no conversation"}
          />
        </div>
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
const CONVERSATION_ROW_PREFIX = "conversation:";
const NEW_CONVERSATION_ROW = "conversation:new";

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
  // Conversations get rows of their own for the same reason programs do: the
  // `chat` app is doc-bound, so the launcher skips it, and a chat tile with
  // no conversation would open empty.
  const conversations = useConversations(chat.conversations, (registry) => registry.all());
  const rows = useCallback(
    (context: LauncherRowsContext): LauncherRow[] => [
      ...defaultLauncherRows(context),
      {
        id: NEW_CONVERSATION_ROW,
        kind: "app" as const,
        appId: "chat",
        title: "new conversation",
        detail: "start another agent and open it beside this tile",
      },
      ...conversations
        .filter((snapshot) => !snapshot.archived && (context.query === "" || snapshot.title.toLowerCase().includes(context.query)))
        .map((snapshot) => ({
          id: `${CONVERSATION_ROW_PREFIX}${snapshot.id}`,
          kind: "app" as const,
          appId: "chat",
          title: snapshot.title,
          detail: `conversation · ${snapshot.messageCount} message${snapshot.messageCount === 1 ? "" : "s"}${snapshot.active ? " · active" : ""}${snapshot.open ? "" : " · closed"}`,
        })),
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
    [programs, conversations],
  );
  const choose = useCallback((row: LauncherRow, context: LauncherRowsContext): boolean => {
    const near = context.invocation.target;
    if (row.id === NEW_CONVERSATION_ROW) {
      void chat.router.perform({ kind: "conversation.new", ...(near ? { near } : {}) });
      workbench.verbs.closeLauncher();
      return true;
    }
    if (row.id.startsWith(CONVERSATION_ROW_PREFIX)) {
      void chat.router.perform({
        kind: "conversation.open",
        conversationId: row.id.slice(CONVERSATION_ROW_PREFIX.length),
        ...(near ? { near } : {}),
      });
      workbench.verbs.closeLauncher();
      return true;
    }
    if (!row.id.startsWith(PROGRAM_ROW_PREFIX)) return false;
    workbench.verbs.openView("script", { [PROGRAM_BINDING]: row.id.slice(PROGRAM_ROW_PREFIX.length) }, near ? { near } : {});
    workbench.verbs.closeLauncher();
    return true;
  }, []);
  return (
    <>
      {/* The human door to workspace.select. The agent can create a workspace
          and switch to it; without this the user could not switch back. */}
      {/* Each workspace IS a `<workspace>` object: left-click goes to it,
          right-click offers go-to / duplicate / rename / delete / ask — the
          same menu a mention of it in the transcript offers. The strip's own
          default button would be a second door to the same verbs. */}
      <workbench.WorkspaceStrip
        addLabel="workspace"
        renderWorkspace={(workspace, placement) => (
          <RefPresentation
            reference={{
              type: "workspace",
              id: workspace.id,
              value: { name: workspace.name || workspace.id, tileCount: placement.tileCount, active: placement.active },
            }}
            doc={`workspace · ${placement.tileCount} tile${placement.tileCount === 1 ? "" : "s"}${placement.active ? " · you are here" : ""}`}
            activate={{ run: () => void chat.router.perform({ kind: "workspace.select", workspaceId: workspace.id }), doc: "go to this workspace" }}
          >
            <Text size="tiny" strong={placement.active}>
              {placement.active ? "▸ " : ""}
              {workspace.name || workspace.id}
            </Text>
          </RefPresentation>
        )}
      />
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

