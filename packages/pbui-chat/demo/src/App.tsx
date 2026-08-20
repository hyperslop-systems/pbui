import { AppBody, CheckboxRow, KindLegend, SectionLabel, Surface, Text, Toolbar } from "@hyperslop-systems/pbui";
import { ChatProvider, selectOverlay, useChatClient, useChatSelector, type ChatProviderConfig } from "@go-go-golems/chat-provider";
import { useReferenceIndex } from "@hyperslop-systems/pbui-chat";
import { useEffect, useMemo, useState } from "react";
import styles from "./App.module.css";
import { chat } from "./chat";
import { TONES, type Environment, type PresentationType } from "./pbui/types";

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
            <Text size="tiny" tone="faint">
              {overlay.wsStatus}
            </Text>
          </Toolbar>
        </Surface>

        <main className={styles.grid}>
          <Surface as="section" tone="pane" border="hair" className={styles.chat} aria-label="conversation">
            <AppBody flush className={styles.transcript}>
              <chat.Messages />
            </AppBody>
            <chat.Composer />
            <chat.MouseDocLine ambient={overlay.sessionId ? `session ${overlay.sessionId}` : "no session yet"} />
          </Surface>

          <aside className={styles.side} aria-label="panels">
            <Panel label="inspector">
              <chat.InspectorPanel />
            </Panel>
            <Panel label="watchlist">
              <chat.WatchlistPanel />
            </Panel>
            <Panel label="trace">
              <chat.TracePanel />
            </Panel>
            <Panel label="tiles">
              <chat.TilesPanel />
            </Panel>
          </aside>
        </main>
      </div>
      <chat.ObjectMenu />
      <chat.AcceptBanner />
    </chat.Provider>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Surface as="section" tone="pane" border="hair" className={styles.panel} aria-label={label}>
      <div className={styles.panelHead}>
        <SectionLabel>{label}</SectionLabel>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </Surface>
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
