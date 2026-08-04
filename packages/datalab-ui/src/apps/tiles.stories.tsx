/**
 * A story for EVERY registered application, rendered FROM THE REGISTRY.
 *
 * Twenty-two components in `components/organisms/` have a story, because
 * `test/stories.test.ts` insists on it. Until this file, no *tile* did — and the
 * difference is not pedantry. An organism story proves the panel draws; it
 * proves nothing about the container above it, which is where the hooks, the
 * derivations, the signed-out branch and the "no document" branch live. Every
 * one of those is a state of the product that had never been looked at outside a
 * running workbench.
 *
 * Three properties follow from looking each application up **by id** rather than
 * importing its component, and the third is the one that pays:
 *
 *  1. A story renders exactly what a tile renders — the same descriptor, the
 *     same `AppProps`, the same providers.
 *  2. An application that stops registering itself fails its story LOUDLY
 *     instead of quietly vanishing from the launcher, where nobody looks. The
 *     registry is populated by side-effect imports in `apps/all.ts`, so a
 *     linter that "cleans up" one of those imports empties a slot in silence.
 *  3. `AllTiles` is generated from `allApps()`, so an application added without
 *     a story is impossible — the contact sheet grows on its own.
 *
 * ## No server, ever
 *
 * Every story runs against the committed fixture tables through `makeStore`'s
 * `fixtures` option (DR-48), so the base query answers from memory and the
 * chart, table, pipeline and encoding tiles render real data with the API
 * absent. The account tiles (`signin`, `profile`, `tokens`, `upload`) have no
 * fixture equivalent — `/v1/me` genuinely is a server call — so they render
 * their **signed-out** branch, which is the correct default: that is the state a
 * first visitor sees, and it is the one nobody had looked at.
 *
 * ## Why the stage is assembled rather than borrowed
 *
 * `.storybook/withPbui` supplies a *display-only* PBUI context whose verbs are
 * collected into a log. That is right for an atom and wrong here: a tile's
 * interesting behaviour is what its verbs do to the world. So these stories
 * turn the decorator off (`parameters.pbui = false`) and mount the product's own
 * `WorkbenchProviders`, whose `perform` runs `actionsForVerb` against a real
 * store. Right-clicking a chip in one of these stories dispatches.
 */

import { EmptyState, Text } from "@hyperslop-systems/pbui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type React from "react";
import { useRef } from "react";
import { Provider, useSelector } from "react-redux";
import { fixturesFrom, type FixtureData } from "../api/fixtures";
import { AnalysisProvider } from "../appkit/AnalysisProvider";
import { AppScope } from "../appkit/AppScope";
import { allApps, appFor, type AppProps } from "../appkit/registry";
import { TourContentProvider, type TourContent } from "../appkit/TourContent";
import { WorkbenchProviders } from "../components/pages/Workbench/WorkbenchProviders";
import { census, readings } from "../fixtures";
import { createDefaultGraphic } from "../model/graphicAuthoring";
import { AcceptBanner, MouseDocLine, ObjectMenu } from "../pbui";
import { makeStore, type AppStore, type PreloadedState, type RootState } from "../store";
import { singleStageLayout } from "../store/stages";
import { newId } from "../store/world";
import {
  briefGoals,
  briefHints,
  briefQuestion,
  grammarLessons,
  MODULES,
  objectsLessons,
} from "../tour";

// The registry is populated by side effect. Without this import every story
// below renders its "not registered" state, which is exactly the failure the
// file is designed to make loud — so it must be loud about its own setup too.
import "./all";

/** Both committed tables, answered from memory. No story reaches the network. */
const FIXTURES: FixtureData = fixturesFrom(readings, census);

/**
 * A world holding one document already pointed at the stream fixture.
 *
 * `createDefaultGraphic` is the same function `useDocTable` applies when a table
 * first arrives, so the encoding here is the encoding the product would infer. A
 * hand-written mapping would assert what the engine produces rather than show
 * it, and the two drift the first time the default changes.
 */
function seededWorld(): NonNullable<PreloadedState["world"]> {
  const id = newId();
  return {
    docs: { [id]: createDefaultGraphic(id, "α", readings) },
    docOrder: [id],
    activeDocId: id,
  };
}

interface StageOptions {
  /** Start from an empty world — the "nothing here yet" branch of a tile. */
  empty?: boolean;
  /** Teaching content, for the four tour tiles that read it from context. */
  tour?: TourContent;
  /** Which applications the view switcher offers, if the story is about that. */
  apps?: readonly string[];
  height?: number;
}

/**
 * One tile, in the product's providers, over its own store.
 *
 * The store is built in a ref rather than in `useState`'s lazy initialiser for
 * the reason `WorkbenchInstance` gives: StrictMode double-invokes the
 * initialiser and would construct two stores, discarding one after its
 * middleware had already started.
 */
/**
 * The tile, reading its view from the STORE rather than from a snapshot.
 *
 * `Stage` seeds a real placement and a real logical view precisely so that
 * `DocBar` can re-point the view in the layout slice — the comment below says
 * so, and says that a synthetic view "makes that control a no-op and the story
 * teaches it is broken". It then passed the view object captured at
 * initialisation, so the control dispatched correctly and the tile kept
 * rendering the old document anyway. The story taught the same wrong thing by
 * a different route.
 *
 * Selecting by id is what subscribes this subtree to the slice. Caught in
 * review on pbui PR #9.
 */
function LiveTile({
  Component,
  placementId,
  viewId,
}: {
  Component: React.ComponentType<AppProps>;
  placementId: string;
  viewId: string;
}): React.JSX.Element {
  const view = useSelector((state: RootState) => state.layout.views[viewId]);
  if (!view) throw new Error(`the story's view ${viewId} left the layout slice`);
  return <Component placementId={placementId} view={view} />;
}

function Stage({
  id,
  Component,
  empty = false,
  tour,
  apps,
  height = 460,
}: StageOptions & {
  id: string;
  Component: React.ComponentType<AppProps>;
}): React.JSX.Element {
  const storeRef = useRef<AppStore | null>(null);
  const stageRef = useRef<{ placementId: string; viewId: string } | null>(null);

  if (!storeRef.current) {
    const world = empty ? { docs: {}, docOrder: [], activeDocId: null } : seededWorld();
    const docId = world.activeDocId ?? null;

    // A REAL placement and a REAL logical view, seeded through the same builder
    // the product's stages use. Synthesising an `AppView` literal instead would
    // render identically and lie about one thing that matters: the document bar
    // re-points a view *in the layout slice*, so a view the store has never
    // heard of makes that control a no-op and the story teaches it is broken.
    const layout = singleStageLayout("story", (builder) => builder.leaf(id, docId));
    const tree = layout.spaces[0]!.tree;
    if (tree.type !== "leaf") throw new Error("the story layout is a single leaf");

    storeRef.current = makeStore({
      preloaded: { world, layout },
      // `seed: false`, so the empty world stays empty. `makeStore` defaults to
      // giving a document-less world a document, which is right for the product
      // and would silently delete the "no documents" story below.
      seed: !empty,
      fixtures: FIXTURES,
    });
    stageRef.current = { placementId: tree.id, viewId: tree.viewId };
  }

  const stage = stageRef.current!;

  const tile = (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "1fr auto",
        height,
        minHeight: 0,
        border: "var(--pbui-border-firm)",
        background: "var(--pbui-pane)",
        overflow: "hidden",
      }}
    >
      {/*
        A one-cell grid with a committed height, not a flex column.

        `height: 100%` inside a flex parent resolves against a height flex has
        not committed to, so every tile collapses to its content and a story
        that "looks empty" usually is not. The same trap `withPbui` documents
        for the tile decorator, restated because this file bypasses it.
      */}
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "1fr" }}>
        <LiveTile Component={Component} placementId={stage.placementId} viewId={stage.viewId} />
      </div>
      <MouseDocLine ambient="right-click anything · verbs dispatch into this story's store" />
    </div>
  );

  return (
    <Provider store={storeRef.current}>
      <AnalysisProvider principalKey={`storybook-tile-${id}`}>
        <AppScope apps={apps}>
          <WorkbenchProviders>
            <TourContentProvider content={tour ?? {}}>{tile}</TourContentProvider>
            <AcceptBanner />
            <ObjectMenu />
          </WorkbenchProviders>
        </AppScope>
      </AnalysisProvider>
    </Provider>
  );
}

/**
 * Look an application up by id and fail LOUDLY if it is not registered.
 *
 * Loud, not blank: an application that stopped registering itself must break its
 * story rather than quietly disappear from the launcher. `EmptyState` names the
 * likely cause, because the cause is nearly always the same one — `apps/all.ts`
 * imports each module for its side effect, and a tool that prunes "unused"
 * imports empties the registry without touching a component.
 */
function renderTile(id: string, options: StageOptions = {}): React.JSX.Element {
  const descriptor = appFor(id);
  if (!descriptor) {
    return (
      <EmptyState
        message={`No application is registered as “${id}”.`}
        hint="Check that apps/all.ts still imports its module — the import is for its side effect, and a linter that removes it empties the launcher."
      />
    );
  }
  return <Stage id={id} Component={descriptor.Component} {...options} />;
}

const meta: Meta = {
  title: "Applications/Tiles",
  parameters: {
    // The stage brings the product's own PbuiProvider, a real store and its own
    // frame. The decorators' versions of all three would render a second accept
    // banner, a second mouse-doc line and a verb log describing a context
    // nothing is using — chrome a reviewer cannot tell apart from the tile's.
    pbui: false,
    tile: false,
    layout: "fullscreen",
  },
};
export default meta;

type Story = StoryObj;

// --- the composition: source ⊳ pipeline ⊳ encoding ⊳ chart -------------------

/** The catalogue of drops, streams and datasets. Serverless, so: its empty state. */
export const Sources: Story = { render: () => renderTile("sources") };

/** dplyr as objects: filter, derive, group∑, sort, limit over the fixture stream. */
export const Pipeline: Story = { render: () => renderTile("pipeline") };

/** `aes()` as objects: the slot ↦ field mappings, the geom and the scale. */
export const Encoding: Story = { render: () => renderTile("encode") };

/** The chart itself, drawn from the same composition the encoding tile edits. */
export const Chart: Story = { render: () => renderTile("chart") };

/** A view of one composition with no composition to view. */
export const ChartWithNoDocument: Story = { render: () => renderTile("chart", { empty: true }) };

/** The pipeline's output as rows, bounded by the tile rather than by the data. */
export const Table: Story = { render: () => renderTile("table") };

// --- the world --------------------------------------------------------------

/** Every open document at once — the tile that answers "what am I working on". */
export const Charts: Story = { render: () => renderTile("charts") };

/** The snapshot gallery. Empty until something is snapshotted, which is honest. */
export const Gallery: Story = { render: () => renderTile("gallery") };

/** Two pinned snapshots side by side. Its empty state is the pins, unset. */
export const Compare: Story = { render: () => renderTile("compare") };

/** Whatever was last inspected, as JSON. Nothing has been, so: the invitation. */
export const Inspector: Story = { render: () => renderTile("inspector") };

/** The watchlist: values a Watch… command was pointed at. */
export const Watchlist: Story = { render: () => renderTile("watch") };

/** The trace. Empty in a story, because a story performs no gestures. */
export const Trace: Story = { render: () => renderTile("trace") };

/** The stored template library, read from localStorage. */
export const Templates: Story = { render: () => renderTile("templates") };

// --- the shell ---------------------------------------------------------------

/** The empty tile: what every split produces, and the way into everything else. */
export const Launcher: Story = { render: () => renderTile("launcher") };

/**
 * The launcher with a narrowed vocabulary (DR-53).
 *
 * A tour section teaching the grammar has no business offering the token
 * manager. `AppScope` is the mechanism and this is the only story that shows it
 * from the tile's own side rather than through a whole embedded instance.
 */
export const LauncherScoped: Story = {
  render: () => renderTile("launcher", { apps: ["chart", "table", "pipeline", "encode"] }),
};

/** The glossary, drawn with live chips of each presentation type. */
export const About: Story = { render: () => renderTile("about") };

// --- accounts ----------------------------------------------------------------

/**
 * Sign in. There is no server in a story, so `/v1/me` fails and this renders the
 * anonymous branch — which is the state a first visitor actually sees and the
 * one that had never been looked at outside a running deployment.
 */
export const SignIn: Story = { render: () => renderTile("signin") };

/** Sign up: the same, one step earlier. */
export const SignUp: Story = { render: () => renderTile("signup") };

/** The account and its drop memberships, signed out. */
export const Profile: Story = { render: () => renderTile("profile") };

/** API tokens, signed out. */
export const Tokens: Story = { render: () => renderTile("tokens") };

/** Publishing a dataset, signed out — "sign in to publish a dataset". */
export const Upload: Story = { render: () => renderTile("upload") };

// --- the teaching layer ------------------------------------------------------

/**
 * The lesson rail, carrying §A's lessons.
 *
 * Content arrives through `TourContentProvider` rather than through props,
 * because a tile names an application by id and carries nothing else (DR-11).
 * That indirection is exactly why these four tiles need a story: the wiring is
 * invisible from the component and there is no other place it is exercised
 * outside a whole tour section.
 */
export const Lessons: Story = {
  render: () => renderTile("lessons", { tour: { lessons: objectsLessons } }),
};

/** The same rail teaching §C, so the "same application, different content" claim is visible. */
export const LessonsGrammar: Story = {
  render: () => renderTile("lessons", { tour: { lessons: grammarLessons } }),
};

/** The rail opened OUTSIDE a tour — the empty state a reader reaches from the launcher. */
export const LessonsOutsideATour: Story = { render: () => renderTile("lessons") };

/** The cheat sheet for §A. */
export const Cheat: Story = {
  render: () =>
    renderTile("cheat", {
      tour: {
        cheat: {
          title: "Objects",
          rows: [
            ["hover", "the doc line names the object and what L and R will do"],
            ["left-click", "the default verb — or the menu, if the object has none"],
            ["right-click", "every verb this type has"],
            ["red banner", "a command is accepting an argument · Esc aborts"],
          ],
        },
      },
    }),
};

/** The cheat sheet with nothing to sheet. */
export const CheatOutsideATour: Story = { render: () => renderTile("cheat") };

/** The module rack: every application, what it emits, what it accepts. */
export const Modules: Story = {
  render: () => renderTile("modules", { tour: { modules: MODULES } }),
};

/** The capstone brief: the question, the goals and the hints behind them. */
export const Brief: Story = {
  render: () =>
    renderTile("brief", {
      tour: { brief: { question: briefQuestion, goals: briefGoals, hints: briefHints } },
    }),
};

/** The brief outside a tour. */
export const BriefOutsideATour: Story = { render: () => renderTile("brief") };

// --- the tutorial tiles ------------------------------------------------------

/** §1 of the guided tutorial. */
export const Tutorial1: Story = { render: () => renderTile("tut1") };
/** §2. */
export const Tutorial2: Story = { render: () => renderTile("tut2") };
/** §3. */
export const Tutorial3: Story = { render: () => renderTile("tut3") };
/** §4. */
export const Tutorial4: Story = { render: () => renderTile("tut4") };

// --- the contact sheet -------------------------------------------------------

/**
 * EVERY registered application, generated from `allApps()`.
 *
 * This is the story that makes the rule enforce itself. An application added to
 * the registry appears here whether or not anybody wrote a story for it, so
 * "every tile has a story" is true by construction rather than by discipline —
 * and the two-line descriptor header above each frame doubles as a review of the
 * `docBound`/`duplicable`/`singleton` triple that `test/apps.test.ts` checks
 * arithmetically but nobody has ever seen laid out.
 */
export const AllTiles: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16, padding: 12 }}>
      {allApps().map((descriptor) => (
        <div key={descriptor.id}>
          <Text size="small">
            <strong>{descriptor.title}</strong>
          </Text>
          <Text size="tiny" tone="faint">
            #{descriptor.id} · {descriptor.docBound ? "doc-bound" : "world-scoped"} ·{" "}
            {descriptor.duplicable ? "duplicable" : "not duplicable"} ·{" "}
            {descriptor.singleton ? "singleton" : "many"}
          </Text>
          {renderTile(descriptor.id, { ...CONTACT_SHEET[descriptor.id], height: 300 })}
        </div>
      ))}
    </div>
  ),
};

/**
 * What the contact sheet hands the four tiles that read their content from
 * context. Without it they render their empty state, which is true but makes the
 * sheet less useful than it could be for four of its twenty-eight frames.
 */
const CONTACT_SHEET: Record<string, StageOptions> = {
  lessons: { tour: { lessons: objectsLessons } },
  modules: { tour: { modules: MODULES } },
  brief: { tour: { brief: { question: briefQuestion, goals: briefGoals, hints: briefHints } } },
};
