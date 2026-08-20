import { Button, JsonBlock, Stack, Text } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { defineApp, type AppProps } from "../apps";

/*
 * Two throwaway applications for the stories and the tests: a counter whose
 * state lives in the tile (so a duplicate starts fresh) and a notes tile that
 * shows what the workbench handed it. The tones are pbui's own tokens, so
 * no product token sheet is needed to render them.
 */

function CounterApp({ placementId, view }: AppProps) {
  const [count, setCount] = useState(0);
  return (
    <div data-part="counter-app">
      <Stack gap={2}>
        <Text size="small">
          counter in <code>{placementId}</code> · view <code>{view.id}</code>
        </Text>
        <Text size="title" strong>
          {count}
        </Text>
        <div>
          <Button variant="framed" onClick={() => setCount((n) => n + 1)}>
            count
          </Button>
        </div>
      </Stack>
    </div>
  );
}

function NotesApp({ placementId, view }: AppProps) {
  return (
    <div data-part="notes-app">
      <Stack gap={2}>
        <Text size="small" tone="faint">
          a singleton: the launcher offers “go to” once it is on screen
        </Text>
        <JsonBlock
          value={{
            placementId,
            view: {
              id: view.id,
              appId: view.appId,
              documents: view.documents,
              title: view.title,
            },
          }}
        />
      </Stack>
    </div>
  );
}

export const counterApp = defineApp({
  id: "counter",
  title: "counter",
  tone: "var(--pbui-cat-3)",
  singleton: false,
  Component: CounterApp,
});

export const notesApp = defineApp({
  id: "notes",
  title: "notes",
  tone: "var(--pbui-selected)",
  singleton: true,
  Component: NotesApp,
});

export const demoApps = [counterApp, notesApp];
