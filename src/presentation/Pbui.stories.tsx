import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type CSSProperties } from "react";
import { available, unavailable } from "./actions";
import {
  actionsHelp,
  builtinHelpItems,
  createHelpRendererRegistry,
  fieldsHelp,
  markdownHelp,
} from "../components/ContextHelp";
import { createPbui } from "./createPbui";
import { definePresentation } from "./model";

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

const p = definePresentation<ExampleValues, ExampleEnvironment, ExampleEnvironment, ExampleVerb>();
const define = p.actions;

/**
 * ONE compiled presentation (PBUI-KERNEL-1): types, descriptors, actions and
 * help rules declared together. The plain example passes no help renderers,
 * so its help surface stays off; the help example passes them.
 */
const examplePresentation = p.create({
  id: "story.example",
  types: [{ id: "person" }, { id: "project" }],
  knownScopes: ["global"],
  defaultActiveScopes: ["global"],
  revision: (facts) => facts.currentUserId,
  descriptors: {
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
  },
  actions: [
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
  help: [
    p.help.exact("person", {
      id: "story.person.help",
      scopes: ["global"],
      help: ({ subject, snapshot }) => [
        markdownHelp.create({
          id: "person.meaning",
          title: "Person",
          order: 0,
          payload: {
            markdown:
              "A **person** can be emailed from their menu.\n\n- hover shows this card\n- keyboard focus shows the same card",
          },
        }),
        fieldsHelp.create({
          id: "person.fields",
          title: "Details",
          order: 10,
          payload: {
            fields: [
              { label: "Name", value: subject.value.name },
              { label: "Email", value: subject.value.email },
            ],
          },
        }),
        actionsHelp.create({
          id: "person.actions",
          title: "Actions",
          order: 20,
          payload: {
            // The REAL action resolution, rendered informationally.
            actions: examplePresentation.actions.resolve({ subject, invocation: "menu" }, snapshot).actions,
          },
        }),
      ],
    }),
  ],
});

const contextFor = (_query: unknown, environment: ExampleEnvironment) => ({ facts: environment });
const logRefusal = (refusal: unknown) => console.warn("pbui refused a stale action", refusal);

const examplePbui = createPbui({
  presentation: examplePresentation,
  defaultEnvironment: { currentUserId: "person-1" },
  contextFor,
});

function Example({ themed = false }: { themed?: boolean }) {
  const [lastVerb, setLastVerb] = useState<ExampleVerb | null>(null);
  return (
    <examplePbui.Provider onPerform={setLastVerb} onRefuse={logRefusal}>
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

/* ---------------------------------------------------------------------------
 * Contextual help (PBUI-HELP-001): the same typed subjects explain themselves
 * on hover and on keyboard focus. Help rules ride the action kernel's type
 * graph, scopes, and snapshot; the actions row below is the REAL action
 * resolution rendered informationally.
 */

const helpPbui = createPbui({
  presentation: examplePresentation,
  defaultEnvironment: { currentUserId: "person-1" },
  contextFor,
  helpRenderers: createHelpRendererRegistry(builtinHelpItems),
});

function HelpExample() {
  const [lastVerb, setLastVerb] = useState<ExampleVerb | null>(null);
  return (
    <helpPbui.Provider onPerform={setLastVerb} onRefuse={logRefusal}>
      <div style={{ display: "grid", gap: "1rem", padding: "2rem" }}>
        <p>Rest the pointer on a presentation — or Tab to it — for its help card.</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <helpPbui.Presentation
            reference={{
              type: "person",
              value: { id: "person-2", name: "Ada Lovelace", email: "ada@example.test" },
            }}
          >
            Ada Lovelace
          </helpPbui.Presentation>
          <helpPbui.Presentation
            reference={{
              type: "person",
              value: { id: "person-1", name: "You", email: "you@example.test" },
            }}
          >
            You (email action unavailable)
          </helpPbui.Presentation>
        </div>
        <output>{lastVerb ? JSON.stringify(lastVerb) : "No action performed"}</output>
        <helpPbui.ObjectMenu />
        <helpPbui.ContextHelp />
      </div>
    </helpPbui.Provider>
  );
}

export const WithContextualHelp: Story = {
  render: () => <HelpExample />,
};
