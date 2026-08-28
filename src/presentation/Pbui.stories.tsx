import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type CSSProperties } from "react";
import {
  available,
  createActionRegistry,
  createPresentationTypeGraph,
  defineActions,
  unavailable,
} from "./actions";
import { createPbui } from "./createPbui";
import { createPresentationRegistry } from "./registry";

interface ExampleValues {
  person: { id: string; name: string; email: string };
  project: { id: string; title: string; archived: boolean };
}

interface ExampleEnvironment {
  currentUserId: string;
}

type ExampleVerb =
  | { type: "emailPerson"; personId: string }
  | { type: "archiveProject"; projectId: string };

const registry = createPresentationRegistry<ExampleValues, ExampleEnvironment>({
  person: {
    label: (person) => person.name,
    describe: (person) => person,
    tone: "accent",
  },
  project: {
    label: (project) => project.title,
    describe: (project) => project,
    tone: "positive",
  },
});

const define = defineActions<ExampleValues, ExampleEnvironment, ExampleVerb>();
const exampleActions = createActionRegistry<ExampleValues, ExampleEnvironment, ExampleVerb>({
  graph: createPresentationTypeGraph([{ id: "person" }, { id: "project" }]),
  scopes: ["global"],
  contributions: [
    define.exact("person", {
      id: "story.person.email",
      action: "person.email",
      scopes: ["global"],
      // Unavailability is one value — the fact and its reason cannot drift
      // apart the way the pre-kernel disabled/disabledReason pair could.
      test: ({ subject, snapshot }) =>
        subject.value.id === snapshot.product.currentUserId
          ? unavailable("You cannot email yourself from this example")
          : available(),
      metadata: { label: "Send email" },
      bind: ({ subject }) => ({ type: "emailPerson", personId: subject.value.id }),
    }),
    define.exact("project", {
      id: "story.project.archive",
      action: "project.archive",
      scopes: ["global"],
      test: ({ subject }) =>
        subject.value.archived ? unavailable("Already archived") : available(),
      metadata: { label: "Archive project", danger: true },
      bind: ({ subject }) => ({ type: "archiveProject", projectId: subject.value.id }),
    }),
  ],
});

const examplePbui = createPbui({
  registry,
  defaultEnvironment: { currentUserId: "person-1" },
  actions: exampleActions,
  snapshotFor: (_query, environment) => ({
    revision: environment.currentUserId,
    scopes: ["global"],
    modes: new Set<string>(),
    capabilities: new Set<string>(),
    product: environment,
  }),
});

function Example({ themed = false }: { themed?: boolean }) {
  const [lastVerb, setLastVerb] = useState<ExampleVerb | null>(null);
  return (
    <examplePbui.Provider onPerform={setLastVerb}>
      <div
        style={
          themed
            ? ({
                "--pbui-color-surface": "#172554",
                "--pbui-color-border": "#60a5fa",
                "--pbui-color-text": "#dbeafe",
                "--pbui-color-accent": "#f59e0b",
                display: "grid",
                gap: "1rem",
                padding: "2rem",
                background: "#020617",
                color: "#e2e8f0",
              } as CSSProperties)
            : { display: "grid", gap: "1rem", padding: "2rem" }
        }
      >
        <p>Right-click a presentation to open its descriptor-provided menu.</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <examplePbui.Presentation
            reference={{
              type: "person",
              value: { id: "person-2", name: "Ada Lovelace", email: "ada@example.test" },
            }}
          >
            Ada Lovelace
          </examplePbui.Presentation>
          <examplePbui.Presentation
            reference={{
              type: "project",
              value: { id: "project-1", title: "Analytical Engine", archived: false },
            }}
          >
            Analytical Engine
          </examplePbui.Presentation>
        </div>
        <output>{lastVerb ? JSON.stringify(lastVerb) : "No action performed"}</output>
        <examplePbui.ObjectMenu />
      </div>
    </examplePbui.Provider>
  );
}

const meta = {
  title: "Presentation/PBUI Protocol",
  component: Example,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ThemeOverrides: Story = {
  args: {
    themed: true,
  },
};

export const TwoIsolatedProviders: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      <Example />
      <Example themed />
    </div>
  ),
};
