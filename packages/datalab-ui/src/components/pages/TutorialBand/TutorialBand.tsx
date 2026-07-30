import "../../../apps/all";
import { Text } from "@hyperslop-systems/pbui";
import { TourSection } from "../TourSection";
import {
  MODULES,
  TOUR_FIXTURES,
  briefGoals,
  briefHints,
  briefQuestion,
  briefSeed,
  grammarLessons,
  grammarSeed,
  layoutLessons,
  layoutSeed,
  objectsLessons,
  objectsSeed,
  rackSeed,
} from "../../../tour";
import styles from "./TutorialBand.module.css";

/**
 * The tutorial: five sandboxed workbenches, one after another.
 *
 * This was `LandingPage` — a whole page, with its own masthead, hero, sticky
 * section index and closing note. DATADROP-14 turned it into a *band* that
 * `MarketingPage` sets into itself (DR-91), because two pages meant two
 * mastheads, two navigations, two places to change a headline, and a real
 * chance that a visitor who landed on the tour never saw the marketing page at
 * all.
 *
 * What was removed is only the page furniture. The five sections, their seeds,
 * their scoped application lists and the module rack are untouched — and the
 * hero's live workbench moved up into the marketing page's own hero, where it
 * does the same job for a reader who has not decided to start yet.
 *
 * ## Every panel below is the real application
 *
 * Not a screenshot, not a simplified copy, not a demo mode — the same
 * `WorkbenchShell` the product renders, over its own store, answering from
 * committed fixtures instead of from a server (DATADROP-7 DR-48). That identity
 * is the whole basis of the claim that the tutorial is executable
 * documentation: the moment a tour needs its own `ChartApp`, a lesson can go
 * stale without anything failing.
 *
 * Five stores are constructed here, and they share a module graph, a registry,
 * a stylesheet and nothing else (DR-45).
 *
 * ## Applications are scoped per section
 *
 * §A offers nine, §C offers eight, the brief offers everything. The tile
 * dropdown is a menu of *what this panel is for*, and offering the token
 * manager in a section about the grammar of graphics teaches that the two are
 * comparable choices.
 */

/** The vocabulary every section teaches, in the order the sections teach it. */
export const TUTORIAL_SECTIONS = [
  { id: "objects", tag: "A", label: "objects and verbs" },
  { id: "layout", tag: "B", label: "tiles and workspaces" },
  { id: "grammar", tag: "C", label: "the grammar" },
  { id: "modules", tag: "D", label: "the modules" },
  { id: "brief", tag: "✦", label: "the brief" },
] as const;

const CHART_APPS = ["chart", "table", "pipeline", "encode", "sources", "launcher"] as const;

export function TutorialBand() {
  const rack = rackSeed();
  // The rack drives the chart tile. Reaching into the seeded tree for its id is
  // the price of the tree being data rather than a builder with named slots;
  // it is read once, here, rather than threaded through the section.
  const rackTarget = firstLeafOfApp(rack.layout, "chart");

  return (
    <div className={styles.band}>
      <TourSection
        id="objects"
        tag="A"
        title="Objects and verbs"
        blurb={
          <>
            The one idea underneath everything: whatever is displayed stays a first-class handle on
            the real object. It carries its type, so it carries a menu of verbs appropriate to that
            type — and any command can pause and ask you to point at an argument, anywhere on
            screen. Three moves to learn: hover, right-click, accept.
          </>
        }
        config={{
          fixtures: TOUR_FIXTURES,
          preloaded: objectsSeed(),
          apps: [
            "sources",
            "inspector",
            "watch",
            "trace",
            "chart",
            "table",
            "lessons",
            "cheat",
            "launcher",
          ],
          workspaces: false,
        }}
        lessons={objectsLessons}
        cheat={{
          title: "Objects",
          rows: [
            ["hover", "the doc line names the object and what L and R will do"],
            ["left-click", "the default verb — or the menu, if the object has none"],
            ["right-click", "every verb this type has"],
            ["red banner", "a command is accepting an argument · Esc aborts"],
            [
              "the types",
              "field · source · doc · chart · step · datum · cat · geom · channel · tile · workspace",
            ],
          ],
        }}
      />

      <TourSection
        id="layout"
        tag="B"
        title="Tiles, documents, workspaces"
        blurb={
          <>
            The confusion worth clearing up before anything else:{" "}
            <strong>tiles are windows, documents are the thing</strong>. A chart, table, pipeline or
            encoding tile is a <em>view</em> of one document, named in the DOC strip at its top.
            Point two tiles at the same document and they move together, because they are not
            copies. Then the layout itself — splitting, docking, whole workspaces — becomes safe to
            play with.
          </>
        }
        config={{
          fixtures: TOUR_FIXTURES,
          preloaded: layoutSeed(),
          apps: [...CHART_APPS, "charts", "inspector", "lessons", "cheat"],
        }}
        lessons={layoutLessons}
        cheat={{
          title: "Shell",
          rows: [
            ["⠿ drag", "centre swaps two applications · edge docks the tile there"],
            ["⬌ ⬍ ✕", "split right · split below · close (the document survives)"],
            ["DOC strip", "which document this view shows · ＋ spawns a new one"],
            [
              "ACTIVE doc",
              "the target of verbs fired from object menus — the menu header names it",
            ],
            ["workspaces", "independent layouts over one shared world"],
          ],
        }}
      />

      <TourSection
        id="grammar"
        tag="C"
        title="The grammar of graphics"
        blurb={
          <>
            A chart here is not a type you pick from a menu. It is a composition —{" "}
            <strong>source ⊳ steps ↦ mapping · geom · scale</strong> — and this panel shows all four
            parts at once, editable from either end. The left half is dplyr; the right half is{" "}
            <em>aes()</em>. Watch what happens when you ask for a geometry the data cannot support.
          </>
        }
        tall
        config={{
          fixtures: TOUR_FIXTURES,
          preloaded: grammarSeed(),
          apps: [...CHART_APPS, "lessons", "cheat"],
          workspaces: false,
        }}
        lessons={grammarLessons}
        cheat={{
          title: "Grammar",
          rows: [
            ["the spec", "source ⊳ steps ↦ mapping · geom · scale"],
            ["steps", "filter · derive · group∑ · sort · limit — order is semantics"],
            ["channels", "x · y · colour · size · facet"],
            ["geoms", "point · line · bar · area — each states its type requirements"],
            ["✓ on a step", "disables it in place, so you can A/B your own transform"],
          ],
        }}
      />

      <TourSection
        id="modules"
        tag="D"
        title="The modules"
        blurb={
          <>
            Every application shares one world. The distinction that makes them legible: if a tile
            carries a <strong>DOC strip</strong> it is a view of a single chart document and can be
            re-pointed; if it does not, it is the whole world and there is only one of it. Pick any
            module to swap the large tile to it and read what it emits, what it accepts, and which
            other module people confuse it with.
          </>
        }
        config={{ fixtures: TOUR_FIXTURES, preloaded: rack, workspaces: false }}
        modules={MODULES}
        rackTarget={rackTarget}
        cheat={{
          title: "Modules",
          rows: [
            ["doc-bound", "chart · table · pipeline · encoding"],
            [
              "singletons",
              "sources · charts · snapshots · compare · watchlist · inspector · trace",
            ],
            ["emits", "which presentation types are born in this tile"],
            ["accepts", "which types its commands will pause and ask you for"],
            [
              "the pairs",
              "pipeline≠table · charts≠snapshots · watchlist≠inspector · trace≠pipeline",
            ],
          ],
        }}
      />

      <TourSection
        id="brief"
        tag="✦"
        title="The brief"
        blurb={
          <>
            No lesson rail this time, and no <strong>▶ do it for me</strong>. A question, a
            workbench, and five things that have to be true when you are finished. They tick by
            watching the world, not by watching you — so any route that reaches the same state
            counts, including one nobody wrote down. <em>I&apos;m stuck</em> gives you one hint at a
            time and never the answer.
          </>
        }
        config={{ fixtures: TOUR_FIXTURES, preloaded: briefSeed() }}
        tall
        brief={{ question: briefQuestion, goals: briefGoals, hints: briefHints }}
      />

      <div className={styles.colophon}>
        <Text size="tiny" tone="faint">
          hover documents · L is the default verb · R is every verb · Esc aborts an accept
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          five sandboxed worlds on this page · they share nothing
        </Text>
      </div>
    </div>
  );
}

/** The id of the first leaf running `app`, for the rack to re-point. */
function firstLeafOfApp(
  layout: ReturnType<typeof rackSeed>["layout"],
  app: string,
): string | undefined {
  const space = layout.spaces.find((s) => s.id === layout.currentSpaceId) ?? layout.spaces[0];
  if (!space) return undefined;
  let found: string | undefined;
  const walk = (node: typeof space.tree): void => {
    if (found) return;
    if (node.type === "leaf") {
      if (layout.views[node.viewId]?.appId === app) found = node.id;
    } else {
      walk(node.a);
      walk(node.b);
    }
  };
  walk(space.tree);
  return found;
}
