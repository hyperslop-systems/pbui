import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type CSSProperties } from "react";
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

const registry = createPresentationRegistry<ExampleValues, ExampleEnvironment, ExampleVerb>({
  person: {
    label: (person) => person.name,
    describe: (person) => person,
    tone: "accent",
    actions: (person, environment) => [
      {
        id: "email",
        label: "Send email",
        verb: { type: "emailPerson", personId: person.id },
        disabled: person.id === environment.currentUserId,
        disabledReason: "You cannot email yourself from this example",
      },
    ],
  },
  project: {
    label: (project) => project.title,
    describe: (project) => project,
    tone: "positive",
    actions: (project) => [
      {
        id: "archive",
        label: "Archive project",
        verb: { type: "archiveProject", projectId: project.id },
        danger: true,
        disabled: project.archived,
        disabledReason: project.archived ? "Already archived" : undefined,
      },
    ],
  },
});

const examplePbui = createPbui({
  registry,
  defaultEnvironment: { currentUserId: "person-1" },
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
