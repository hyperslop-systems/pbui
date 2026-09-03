import { Button, JsonBlock, Stack, Text } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { defineWorkbenchApp, type AppProps } from "../app";
import { useEmitPort, usePort } from "../links/hooks";

/*
 * Two throwaway applications for the stories and the tests: a counter whose
 * state lives in the tile (so a duplicate starts fresh) and a notes tile that
 * shows what the workbench handed it. The tones are pbui's own tokens, so
 * no product token sheet is needed to render them.
 *
 * Ports (PBUI-LINK-1): the counter EMITS its count on every press through
 * its `count` out port; the notes tile READS its `subject` in port and shows
 * whatever arrives. Linked, they are the shell's own smallest linking demo.
 */

function CounterApp({ placementId, view }: AppProps) {
  const [count, setCount] = useState(0);
  const emit = useEmitPort(view, "count");
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
          <Button
            variant="framed"
            onClick={() =>
              setCount((n) => {
                emit({ type: "number", value: n + 1 });
                return n + 1;
              })
            }
          >
            count
          </Button>
        </div>
      </Stack>
    </div>
  );
}

function NotesApp({ placementId, view }: AppProps) {
  const subject = usePort(view, "subject");
  return (
    <div data-part="notes-app">
      <Stack gap={2}>
        <Text size="small" tone="faint">
          a singleton: the launcher offers “go to” once it is on screen
        </Text>
        <Text size="small" strong>
          {subject.reference ? `subject: <${subject.reference.type}> ${JSON.stringify(subject.reference.value)}` : "nothing linked in yet"}
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
            subject: { state: subject.badge.state, explanation: subject.badge.explanation },
          }}
        />
      </Stack>
    </div>
  );
}

export const counterApp = defineWorkbenchApp({
  manifest: { id: "counter", ports: [{ name: "count", direction: "out", contract: "number", doc: "the count, each time the button is pressed" }] },
  presentation: { title: "counter", tone: "var(--pbui-cat-3)", Component: CounterApp },
});

export const notesApp = defineWorkbenchApp({
  manifest: { id: "notes", viewCardinality: "one", ports: [{ name: "subject", direction: "in", contract: "any", doc: "anything at all; the tile shows what it was handed" }] },
  presentation: { title: "notes", tone: "var(--pbui-selected)", Component: NotesApp },
});

export const demoApps = [counterApp, notesApp];
