import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StageBar } from "./StageBar";
import { Stack, Surface, Toolbar, Text } from "@hyperslop-systems/pbui";
import {
  DatalabWorkbenchProvider,
  useCurrentStageId,
} from "../../../appkit/DatalabWorkbenchContext";
import { createDatalabWorkbench, datalabDefaultSeed } from "../../../appkit/workbench";
import { datalabManifests } from "../../../appkit/workbenchApps";
import {
  compileSeed,
  pinnedDefinitions,
  workDefinitions,
  type DatalabSeed,
} from "../../../store/seed";
import { WORK_STAGE_ID } from "../../../store/stageIds";
import "../../../apps/all";

/**
 * The stage switcher, at the right end of the masthead.
 *
 * A stage is a named set of workspaces plus an application allow-list plus
 * chrome (DR-58). `work` is the product as it has always been; `welcome` is the
 * tutorial; `account` is where tokens and uploads live; `sign in` is where an
 * unauthenticated visitor is held.
 */
const meta = {
  title: "Component Library/Organisms/StageBar",
  component: StageBar,
  parameters: { tile: false },
} satisfies Meta<typeof StageBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A masthead exactly as the shell assembles it. */
function Masthead() {
  return (
    <Surface tone="inverted" border="none">
      <Toolbar tight>
        <Text size="title" strong>
          DATALAB
        </Text>
        <Text size="tiny" tone="faint">
          DATA · EXPLORE · INSPECT · UNDERSTAND
        </Text>
        <StageBar />
      </Toolbar>
    </Surface>
  );
}

/**
 * The current stage, DERIVED from the core's selected workspace — the same
 * hook the bar reads, so the line below the masthead and the bar can never
 * disagree.
 */
function CurrentStage() {
  const stageId = useCurrentStageId();
  return (
    <Text size="tiny" tone="faint">
      current stage: <code>{stageId}</code>
    </Text>
  );
}

/** One workbench per story, built once over the given seed. */
function Stage({ seed, children }: { seed: () => DatalabSeed; children: React.ReactNode }) {
  const workbench = useMemo(() => createDatalabWorkbench({ seed: seed() }), [seed]);
  return <DatalabWorkbenchProvider workbench={workbench}>{children}</DatalabWorkbenchProvider>;
}

/** The four pinned stages, in a masthead. */
export const Default: Story = {
  render: () => (
    <Stage seed={datalabDefaultSeed}>
      <Stack gap={3}>
        <Masthead />
        <CurrentStage />
        <Text size="tiny" tone="faint" prose>
          ⌾ marks a stage defined in code — the same glyph the workspace strip uses one level down.
          Switching remembers each stage's workspace, so leaving `work` on `gallery` and coming back
          from `account` returns you to `gallery` rather than to `build`.
        </Text>
      </Stack>
    </Stage>
  ),
};

/**
 * The awkward mode: a workbench with exactly one stage.
 *
 * Every embedded tour panel is this — six of them down the landing page, each
 * seeding one stage. A switcher that cannot switch is furniture that reads as a
 * control, so the bar drops to the name alone. This state is expensive to reach
 * by clicking and is a few lines of seed here: the work stage and its four
 * workspaces, and nothing else.
 */
function workStageOnly(): DatalabSeed {
  const work = pinnedDefinitions().stages.find((stage) => stage.id === WORK_STAGE_ID);
  if (!work) throw new Error("the pinned definitions always include the work stage");
  return compileSeed({
    stages: [work],
    workspaces: workDefinitions(),
    apps: datalabManifests(),
  });
}

export const SingleStage: Story = {
  render: () => (
    <Stage seed={workStageOnly}>
      <Stack gap={3}>
        <Masthead />
        <CurrentStage />
      </Stack>
    </Stage>
  ),
};
