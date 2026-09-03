import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { available, hidden, unavailable } from "./actions";
import { createPbui } from "./createPbui";
import { definePresentation } from "./model";
import type { PresentationReference } from "./types";

/**
 * PBUI-KERNEL-4 on screen: the refusal notice, the accept machine's chooser
 * and banner, and original-query introspection under both disclosures.
 * One small presentation serves all three stories.
 */

interface Values {
  person: { id: string; name: string };
  note: { id: string; author: string };
}
type Facts = { locked: boolean };
type Verb = { kind: string; id?: string };

declare global {
  interface Window {
    /** Flipped by the "lock" checkbox — or by a test — AFTER a menu is open, so a row goes stale. */
    __pbuiStoryLocked?: boolean;
  }
}

const p = definePresentation<Values, Record<string, never>, Facts, Verb>();

const presentation = p.create({
  id: "story.interaction",
  types: [{ id: "person" }, { id: "note" }],
  knownScopes: ["global", "admin"],
  defaultActiveScopes: ["global"],
  revision: (facts) => (facts.locked ? "locked" : "open"),
  descriptors: {
    person: { label: (v) => v.name, tone: "accent" },
    note: { label: (v) => `note ${v.id}` },
  },
  actions: [
    p.actions.exact("person", { id: "story.open", action: "presentation.open", scopes: ["global"], test: () => available(), metadata: { label: "Open" }, bind: ({ subject }) => ({ kind: "open", id: subject.value.id }) }),
    p.actions.exact("person", {
      id: "story.email",
      action: "person.email",
      scopes: ["global"],
      test: ({ snapshot }) => (snapshot.product.locked ? unavailable("the directory is locked", "directory-locked") : available()),
      metadata: { label: "Email", description: "goes stale when the directory locks" },
      bind: ({ subject }) => ({ kind: "email", id: subject.value.id }),
    }),
    p.actions.exact("person", { id: "story.audit", action: "person.audit", scopes: ["global"], test: () => hidden("policy"), metadata: { label: "Audit trail" }, bind: () => ({ kind: "audit" }) }),
    p.actions.exact("person", { id: "story.purge", action: "person.purge", scopes: ["admin"], test: () => available(), metadata: { label: "Purge" }, bind: () => ({ kind: "purge" }) }),
  ],
  relations: [
    { id: "note.author", from: "note", to: "person", match: "exact", exposure: { acceptance: true }, apply: (r) => (r.type === "note" ? { type: "person", value: { id: r.value.author, name: "the author" } } : undefined) },
    { id: "note.mentioned", from: "note", to: "person", match: "exact", exposure: { acceptance: true }, apply: (r) => (r.type === "note" ? { type: "person", value: { id: `${r.value.author}-m`, name: "the person mentioned" } } : undefined) },
  ],
});

const pbui = createPbui<Values, Record<string, never>, Verb, Facts>({
  presentation,
  defaultEnvironment: {},
  contextFor: () => ({ facts: { locked: window.__pbuiStoryLocked === true } }),
});

const ADA: PresentationReference<Values> = { type: "person", value: { id: "p-1", name: "Ada Lovelace" } };
const NOTE: PresentationReference<Values> = { type: "note", value: { id: "n-7", author: "p-1" } };

function Frame({ children, note }: { children: React.ReactNode; note: string }) {
  const [last, setLast] = useState<string>("nothing performed yet");
  return (
    <pbui.Provider onPerform={(verb) => setLast(JSON.stringify(verb))}>
      <div style={{ display: "grid", gap: "0.75rem", padding: "1.5rem", maxWidth: 720 }}>
        <p style={{ margin: 0 }}>{note}</p>
        {children}
        <output>{last}</output>
        <pbui.ObjectMenu />
        <pbui.AcceptBanner />
        <pbui.AcceptChooser />
        <pbui.RefusalNotice />
      </div>
    </pbui.Provider>
  );
}

function StaleRow() {
  const [locked, setLocked] = useState(window.__pbuiStoryLocked === true);
  return (
    <Frame note="Right-click Ada and leave the menu open; then lock the directory (the checkbox, or window.__pbuiStoryLocked = true from the console) and click “Email”. The row was resolved before the lock and is refused at click time; the notice says why.">
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={locked}
          onChange={(event) => {
            window.__pbuiStoryLocked = event.target.checked;
            setLocked(event.target.checked);
          }}
        />
        directory locked
      </label>
      <div>
        <pbui.Presentation reference={ADA}>Ada Lovelace</pbui.Presentation>
      </div>
    </Frame>
  );
}

function Chooser() {
  const [picked, setPicked] = useState<string>("no person picked yet");
  function Picker() {
    const context = pbui.usePbui();
    return (
      <button type="button" onClick={() => void context.accept({ types: "person", prompt: "pick a person" }).then((r) => setPicked(r ? `picked ${"name" in r.value ? r.value.name : r.value.id}` : "aborted"))}>
        pick a person…
      </button>
    );
  }
  return (
    <Frame note="Press “pick a person…”, then click the note: it fits a person in two ways, so the chooser opens under the pending request. Escape on the chooser keeps the request (the banner stays); Escape again aborts it.">
      <Picker />
      <div style={{ display: "flex", gap: 12 }}>
        <pbui.Presentation reference={ADA}>Ada Lovelace</pbui.Presentation>
        <pbui.Presentation reference={NOTE}>note n-7</pbui.Presentation>
      </div>
      <output>{picked}</output>
    </Frame>
  );
}

function Explain() {
  const [disclosure, setDisclosure] = useState<"public" | "developer">("public");
  function Panel() {
    const context = pbui.usePbui();
    const explanation = context.explain({ subject: ADA, invocation: "menu" }, disclosure);
    return (
      <pre data-part="explain-panel" style={{ margin: 0, fontSize: 12, maxHeight: 420, overflow: "auto", background: "var(--pbui-color-surface, #f8f8f8)", padding: 12 }}>
        {JSON.stringify(explanation, (key, value) => (key === "label" && typeof value !== "string" ? "<node>" : value), 2)}
      </pre>
    );
  }
  return (
    <Frame note="The same menu query Ada's right-click resolves, explained. Public shows the rows the menu shows (a hidden rule stays hidden, an out-of-scope rule does not appear); developer adds each row's trace and every other candidate with its fate.">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <pbui.Presentation reference={ADA}>Ada Lovelace</pbui.Presentation>
        <label>
          <input type="radio" checked={disclosure === "public"} onChange={() => setDisclosure("public")} /> public
        </label>
        <label>
          <input type="radio" checked={disclosure === "developer"} onChange={() => setDisclosure("developer")} /> developer
        </label>
      </div>
      <Panel />
    </Frame>
  );
}

const meta = {
  title: "Presentation/Interaction (KERNEL-4)",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

export const StaleRowRefusal: StoryObj = { render: () => <StaleRow /> };
export const AcceptChooserAndBanner: StoryObj = { render: () => <Chooser /> };
export const ExplainTheMenu: StoryObj = { render: () => <Explain /> };
