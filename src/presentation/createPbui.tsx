import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { HelpContent } from "../components/ContextHelp";
import type { HelpRendererRegistry } from "../components/ContextHelp";
import { VisuallyHidden } from "../components/foundation";
import { captureFocusReturn, queueFocusReturn } from "../focus";
import { useEscapeSurface } from "../surfaces";
import type { ActionRegistry } from "./actions/registry";
import { evaluateFresh } from "./actions/perform";
import type {
  ActionQuery,
  PerformEnvelope,
  PerformResult,
  ResolutionResult,
  ResolvedAction,
  SelectionSnapshot,
} from "./actions/types";
import type { HelpRegistry } from "./help/registry";
import type { HelpResolution } from "./help/types";
import { resolveAcceptance } from "./translators/resolve";
import type {
  AcceptanceOption,
  AcceptanceResolution,
  PresentationTranslator,
} from "./translators/types";
import type { PresentationDescriptorRegistry } from "./registry";
import type {
  AcceptRequest,
  MenuState,
  PresentationReference,
  PresentationType,
  PresentationValues,
} from "./types";

export interface CreatePbuiOptions<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts,
> {
  registry: PresentationDescriptorRegistry<Values, Environment>;
  defaultEnvironment: Environment;
  renderMenuHeader?: (
    reference: PresentationReference<Values>,
    environment: Environment,
    label: ReactNode,
  ) => ReactNode;
  /**
   * The action-selection kernel (PBUI-ACTIONS-2). REQUIRED since 0.8.0:
   * there is exactly one selection engine, and every menu row, primary
   * click, and agent-visible action resolves through it.
   *
   * `actions` and `snapshotFor` come together: the kernel never reads live
   * stores, so the product must say how a query's immutable fact snapshot
   * is built from the environment.
   */
  actions: ActionRegistry<Values, ProductFacts, Verb>;
  snapshotFor(
    query: ActionQuery<Values>,
    environment: Environment,
  ): SelectionSnapshot<ProductFacts>;
  /**
   * Typed accept translators (PBUI-ACTIONS-2 P6): declared source/target/
   * scope edges resolved by the nearest-scope-then-priority ladder, with a
   * genuine remainder opening the chooser. Acceptance always has
   * graph-subtype satisfaction (the ORIGINAL reference settles the request)
   * whether or not translators are declared. Mount `AcceptChooser` alongside
   * `AcceptBanner` — a product whose translators can tie needs the chooser
   * on screen.
   */
  translators?: readonly PresentationTranslator<Values, ProductFacts>[];
  /**
   * The contextual help kernel (PBUI-HELP-001), OPTIONAL unlike `actions`:
   * with neither `help` nor `helpRenderers` configured, `Presentation`
   * allocates no help state, schedules no timers, and renders exactly the
   * DOM it renders today. When configured, hovering or focusing a
   * presentation resolves additive help rules lazily — against the same
   * `snapshotFor` facts as action introspection — and shows them in the one
   * `ContextHelp` surface the product mounts beside `ObjectMenu`.
   */
  help?: HelpRegistry<Values, ProductFacts>;
  helpRenderers?: HelpRendererRegistry;
}

/** How long the pointer rests on a presentation before its help opens. */
const HELP_POINTER_DELAY_MS = 350;

/**
 * One open help card (design doc §12.2): which subject, resolved to what,
 * anchored where, and via which trigger. The snapshot rides along because
 * custom renderers receive it beside the item payload.
 */
export interface PbuiHelpState<Values extends PresentationValues, ProductFacts> {
  reference: PresentationReference<Values>;
  resolution: HelpResolution;
  snapshot: SelectionSnapshot<ProductFacts>;
  anchor: Element;
  trigger: "pointer" | "focus";
}

export interface PbuiProviderProps<
  Values extends PresentationValues,
  Environment,
  Verb,
> {
  children: ReactNode;
  environment?: Environment;
  /**
   * The product boundary where serialisable presentation verbs become effects.
   * Required because a provider with no router renders working menus whose
   * commands silently disappear.
   *
   * The envelope (PBUI-ACTIONS-3 B1) carries the verb's provenance: the
   * resolved action and candidate ids, the invocation, the subject, and the
   * Provider's `actor`. Existing single-parameter routers keep typechecking —
   * adaptation is a parameter addition, not a rewrite.
   */
  onPerform: (verb: Verb, envelope: PerformEnvelope<Values>) => void | Promise<void>;
  onAccept?: (result: PresentationReference<Values> | null) => void;
  /**
   * Principal attribution for every verb this Provider delegates — "human",
   * "agent:reviewer", whatever the product's seats are called. Threaded
   * verbatim into each envelope's `actor`; absent means the product has one
   * undifferentiated seat. Attribution, not authorization: routers and
   * gateways stay the security boundary.
   */
  actor?: string;
}

/**
 * Marks a click as already handled by a Presentation, so that a Presentation
 * ANCESTOR ignores it while the host element still receives it.
 *
 * `Symbol.for` rather than `Symbol()` so two copies of pbui on one page — the
 * duplicate-React situation the packaging guard covers — still agree.
 */
const PRESENTATION_HANDLED = Symbol.for("pbui.presentation.handled");

export interface PresentationProps<Values extends PresentationValues> {
  reference: PresentationReference<Values>;
  children: ReactNode;
  className?: string;
  doc?: string;
  svg?: boolean;
  block?: boolean;
  /**
   * What a left click does, and what to call it in the mouse-doc strip.
   *
   * Present ⇔ the HOST INSTANCE owns this click. Absent ⇔ a left click
   * resolves the kernel's `primary` invocation: the unique available action
   * marked `metadata.primary` performs; otherwise the menu opens, like a
   * right click. `activate` is the instance-level override for behavior the
   * kernel cannot express — selection, expansion, anything owned by the
   * surrounding organism rather than by the object's type.
   *
   *     activate={{ run: () => onGeom(option), doc: "use this geom" }}
   *
   * # Why these are one prop
   *
   * They were `onActivate?: () => void` and `activateDoc?: string`, and the
   * doc was read only inside the branch that tested the handler:
   *
   *     : onActivate ? `L: ${activateDoc ?? "activate"}   R: menu` : "L/R: menu"
   *
   * So `activateDoc` without `onActivate` type-checked, rendered nothing, and
   * said nothing — the same shape as `disabledReason` without `disabled`, one
   * layer up. No product had written it yet, which is the condition under
   * which such a defect survives indefinitely rather than a reason to leave it.
   *
   * The cost is honest: six call sites got slightly wordier, trading
   * `onActivate={fn} activateDoc="x"` for `activate={{ run: fn, doc: "x" }}`.
   * What is bought is that the doc can no longer be orphaned, and that the
   * mouse-doc string and the behaviour it describes are one value.
   */
  activate?: {
    /**
     * Runs on left click and on Enter/Space.
     *
     * OPTIONAL, which encodes a third state the old pair could not express.
     * The presence of `activate` says "a left click does something rather than
     * opening the menu"; `run` says whether THIS element is what does it.
     *
     *   activate absent            L opens the menu, like R.
     *   activate with run          this element acts, and the host also sees
     *                              the click (P4.1).
     *   activate without run       the HOST owns the click entirely; this
     *                              element only names it in the mouse doc.
     *
     * The third is what a `renderRow` wrapper wants. Before P4.1 a product had
     * to re-implement the organism's own select-and-toggle inside `run` just
     * to undo the swallowed click; now the row's handler runs on its own and
     * duplicating it would fire the toggle twice.
     */
    run?(): void;
    /** Names the verb in the mouse-doc strip. Defaults to "activate". */
    doc?: string;
  };
  /**
   * Set when this presentation is a child of a COMPOSITE WIDGET — a tree, a
   * grid, a listbox — that owns the tab stop.
   *
   * A presentation is normally `role="button"` with `tabIndex={0}`, which is
   * right when it stands alone and wrong inside a composite. `renderRow`
   * produced exactly that:
   *
   *     <div role="treeitem" tabindex="-1">
   *       <span role="button" tabindex="0" aria-label="…">Basic.lean</span>
   *     </div>
   *
   * An interactive control inside a composite widget's item, each with its own
   * tab stop, and the treeitem's roving `tabIndex={-1}` fighting the
   * presentation's `tabIndex={0}`. A screen-reader user gets two competing
   * navigation models, and Tab lands INSIDE rows rather than moving past the
   * tree. It was visible in pbui's own `WithPresentation` story, which is what
   * made it a library decision rather than a product mistake.
   *
   * One flag rather than separate `role` and `tabIndex` props, because those
   * two can disagree and this cannot: the container keeps its semantics, the
   * presentation keeps its menu, its accept behaviour and its mouse-doc.
   */
  inComposite?: boolean;
  testId?: string;
}

export interface PbuiContextValue<
  Values extends PresentationValues,
  Environment,
  Verb,
> {
  environment: Environment;
  accepting: AcceptRequest<Values> | null;
  accept(request: AcceptRequest<Values>): Promise<PresentationReference<Values> | null>;
  abortAccept(): void;
  isAcceptable(reference: PresentationReference<Values>): boolean;
  satisfyAccept(reference: PresentationReference<Values>): void;
  menu: MenuState<Values> | null;
  openMenu(reference: PresentationReference<Values>, x: number, y: number, invoker?: HTMLElement | null): void;
  closeMenu(): void;
  /** Pending translator ambiguity: the user must pick; nothing picks for them. */
  acceptChooser: readonly AcceptanceOption<Values>[] | null;
  chooseAcceptance(option: AcceptanceOption<Values>): void;
  /** Dismisses the chooser; the accept request itself stays pending. */
  dismissAcceptChooser(): void;
  mouseDoc: string | null;
  setMouseDoc(text: string | null): void;
  /**
   * Contextual help (PBUI-HELP-001). `helpEnabled` is static for a pbui
   * instance: false means the three members below are inert and
   * `Presentation` must not schedule hover timers. `openHelp` resolves
   * LAZILY — on the gesture, never per render — and does not open when no
   * rule contributes. `closeHelp(anchor)` closes only the card anchored to
   * that element, so a stale leave cannot dismiss a newer neighbour's help.
   */
  helpEnabled: boolean;
  help: PbuiHelpState<Values, unknown> | null;
  helpSurfaceId: string;
  openHelp(
    reference: PresentationReference<Values>,
    anchor: Element,
    trigger: "pointer" | "focus",
  ): void;
  closeHelp(anchor?: Element): void;
  /**
   * Raw verb delegation for chrome buttons and toolbars that construct their
   * verbs at click time from live props — that path never had the stale-menu
   * problem. Menu-derived actions must go through `performAction`, which
   * revalidates.
   */
  perform(verb: Verb): void | Promise<void>;
  /** Resolve a query against the current environment's snapshot. Pure. */
  resolve(query: ActionQuery<Values>): ResolutionResult<Values, Verb>;
  /**
   * Fresh revalidation, then delegation (PBUI-ACTIONS-2 Amendment A): the
   * query re-resolves against a fresh snapshot; the same candidate must still
   * win its action partition and be available; the FRESH verb is delegated.
   * Refusals never reach `onPerform`.
   */
  performAction(action: ResolvedAction<Values, Verb>): Promise<PerformResult>;
}

export function createPbui<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts,
>({
  registry,
  defaultEnvironment,
  renderMenuHeader,
  actions,
  snapshotFor,
  translators = [],
  help,
  helpRenderers,
}: CreatePbuiOptions<Values, Environment, Verb, ProductFacts>) {
  const Context = createContext<PbuiContextValue<Values, Environment, Verb> | null>(null);

  const actionEngine = actions;
  const snapshotOf = snapshotFor;
  const helpEngine = help ?? null;
  const helpRendererRegistry = helpRenderers ?? null;
  const helpEnabled = helpEngine !== null && helpRendererRegistry !== null;

  const EMPTY_PREDICATES = new Map<string, never>();

  /**
   * One resolution for highlighting AND clicking: graph subtyping (the
   * ORIGINAL reference settles the request), declared translator edges, and
   * chooser ambiguity for a genuine tie.
   */
  function acceptanceFor(
    request: AcceptRequest<Values>,
    reference: PresentationReference<Values>,
    environment: Environment,
  ): AcceptanceResolution<Values> {
    const snapshot = snapshotOf({ subject: reference, invocation: "accept" }, environment);
    return resolveAcceptance(
      { graph: actionEngine.graph, translators, predicates: EMPTY_PREDICATES },
      request,
      reference,
      snapshot,
    );
  }

  function Provider({
    children,
    environment = defaultEnvironment,
    onPerform,
    onAccept,
    actor,
  }: PbuiProviderProps<Values, Environment, Verb>) {
    const [accepting, setAccepting] = useState<AcceptRequest<Values> | null>(null);
    const [acceptChooser, setAcceptChooser] = useState<readonly AcceptanceOption<Values>[] | null>(
      null,
    );
    const [menu, setMenu] = useState<MenuState<Values> | null>(null);
    const [mouseDoc, setMouseDoc] = useState<string | null>(null);
    const [helpState, setHelpState] = useState<PbuiHelpState<Values, ProductFacts> | null>(null);
    const helpSurfaceId = useId();
    const pending = useRef<
      ((result: PresentationReference<Values> | null) => void) | null
    >(null);

    const settle = useCallback((result: PresentationReference<Values> | null) => {
      const resolve = pending.current;
      pending.current = null;
      setAccepting(null);
      setAcceptChooser(null);
      onAccept?.(result);
      resolve?.(result);
    }, [onAccept]);

    const accept = useCallback(
      (request: AcceptRequest<Values>) =>
        new Promise<PresentationReference<Values> | null>((resolve) => {
          if (pending.current) {
            resolve(null);
            return;
          }
          pending.current = resolve;
          setAccepting(request);
          setMenu(null);
        }),
      [],
    );

    // Highlighting and clicking share ONE resolution (source guide §19.4):
    // what lights up as acceptable is exactly what a click can settle — or,
    // for a genuine tie, what the chooser will offer.
    const isAcceptable = useCallback(
      (reference: PresentationReference<Values>) =>
        accepting !== null && acceptanceFor(accepting, reference, environment).kind !== "none",
      [accepting, environment],
    );

    const satisfyAccept = useCallback(
      (reference: PresentationReference<Values>) => {
        if (!accepting) return;
        const resolution = acceptanceFor(accepting, reference, environment);
        if (resolution.kind === "accepted") {
          settle(resolution.option.result);
        } else if (resolution.kind === "ambiguous") {
          // A tie is the user's choice, never the registry's registration
          // order — the request stays pending until they pick or abort.
          setAcceptChooser(resolution.options);
        }
      },
      [accepting, environment, settle],
    );

    /*
     * Lazy resolution on the gesture (§12.2): the same query-local snapshot
     * as action introspection, then the additive help resolver. An empty
     * resolution opens nothing — hovering an object no rule explains must
     * not show an empty card.
     */
    const openHelp = useCallback(
      (
        reference: PresentationReference<Values>,
        anchor: Element,
        trigger: "pointer" | "focus",
      ) => {
        if (!helpEngine) return;
        const snapshot = snapshotOf(
          { subject: reference, invocation: "introspection" },
          environment,
        );
        const resolution = helpEngine.resolve(reference, snapshot);
        if (resolution.items.length === 0) {
          setHelpState(null);
          return;
        }
        setHelpState({ reference, resolution, snapshot, anchor, trigger });
      },
      [environment],
    );

    const closeHelp = useCallback((anchor?: Element) => {
      setHelpState((current) => {
        if (current === null) return null;
        if (anchor !== undefined && current.anchor !== anchor) return current;
        return null;
      });
    }, []);

    const value = useMemo<PbuiContextValue<Values, Environment, Verb>>(
      () => ({
        environment,
        accepting,
        accept,
        abortAccept: () => settle(null),
        isAcceptable,
        satisfyAccept,
        menu,
        openMenu: (reference, x, y, invoker) => {
          // The menu supersedes the hover card: both are transient context
          // surfaces for one subject, and stacking them would double-explain.
          setHelpState(null);
          setMenu({ reference, x, y, returnFocus: captureFocusReturn(invoker) });
        },
        closeMenu: () => setMenu(null),
        acceptChooser,
        chooseAcceptance: (option) => settle(option.result),
        dismissAcceptChooser: () => setAcceptChooser(null),
        mouseDoc,
        setMouseDoc,
        helpEnabled,
        help: helpState,
        helpSurfaceId,
        openHelp,
        closeHelp,
        perform: (verb) => {
          setMenu(null);
          // Chrome-owned delegation: no resolved action stands behind the
          // verb, so the envelope carries only invocation and attribution.
          return onPerform(verb, { invocation: "direct", ...(actor !== undefined ? { actor } : {}) });
        },
        resolve: (query) => actionEngine.resolve(query, snapshotOf(query, environment)),
        performAction: async (stale) => {
          setMenu(null);
          const fresh = actionEngine.resolve(stale.query, snapshotOf(stale.query, environment));
          const decision = evaluateFresh(stale, fresh);
          if (decision.kind !== "proceed") return decision;
          try {
            // Called synchronously within the click segment; the fresh verb,
            // never the stale one — and the envelope is built from the FRESH
            // resolution for the same reason.
            await onPerform(decision.verb, {
              invocation: decision.action.query.invocation,
              action: decision.action.action,
              candidateId: decision.action.candidateId,
              subject: decision.action.query.subject,
              ...(actor !== undefined ? { actor } : {}),
            });
            return { kind: "delegated" };
          } catch (error) {
            return { kind: "failed", error };
          }
        },
      }),
      [
        environment,
        accepting,
        acceptChooser,
        accept,
        isAcceptable,
        satisfyAccept,
        menu,
        mouseDoc,
        helpState,
        helpSurfaceId,
        openHelp,
        closeHelp,
        settle,
        onPerform,
        actor,
      ],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function usePbui(): PbuiContextValue<Values, Environment, Verb> {
    const context = useContext(Context);
    if (!context) throw new Error("PBUI components must be rendered inside their Provider");
    return context;
  }

  function Presentation({
    reference,
    children,
    className,
    doc,
    svg = false,
    block = false,
    activate,
    inComposite = false,
    testId,
  }: PresentationProps<Values>) {
    const pbui = usePbui();
    const acceptable = pbui.isAcceptable(reference);

    /*
     * Contextual help (PBUI-HELP-001 §12.3): the EXISTING enter/leave and
     * focus/blur handlers grow help scheduling — no wrapper element, so SVG,
     * table, and composite markup stay valid. Pointer entry arms a short
     * timer (hover-scrubbing across a grid must not resolve rules per cell);
     * focus opens immediately, as the reliable accessible path. When help is
     * not configured every branch below is dead and the handlers behave
     * exactly as before.
     */
    const helpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelHelpTimer = () => {
      if (helpTimer.current !== null) {
        clearTimeout(helpTimer.current);
        helpTimer.current = null;
      }
    };
    useEffect(() => cancelHelpTimer, []);

    const scheduleHelp = (anchor: Element) => {
      cancelHelpTimer();
      helpTimer.current = setTimeout(() => {
        helpTimer.current = null;
        pbui.openHelp(reference, anchor, "pointer");
      }, HELP_POINTER_DELAY_MS);
    };

    const elementRef = useRef<Element | null>(null);
    const helpOpenHere = pbui.help !== null && pbui.help.anchor === elementRef.current;
    const tone = registry.toneFor(reference);
    const label = registry.labelFor(reference, pbui.environment);
    const labelText =
      typeof label === "string" || typeof label === "number" ? String(label) : reference.type;
    const Tag = svg ? "g" : block ? "div" : "span";

    /**
     * The unique available PRIMARY action for this subject, or null. Lazy —
     * computed on hover, focus, and click, never per render — because a
     * resolution per rendered presentation would put menu-time work on the
     * render path of every grid cell (the datalab cost boundary).
     * Zero primaries or several fall back to the menu: guessing among
     * primaries would reintroduce registration-order semantics.
     */
    const primaryFor = (): ResolvedAction<Values, Verb> | null => {
      const resolution = pbui.resolve({ subject: reference, invocation: "primary" });
      const primaries = resolution.actions.filter(
        (action) => action.primary && action.status.kind === "available",
      );
      return primaries.length === 1 ? (primaries[0] ?? null) : null;
    };

    const clickDoc = () => {
      if (acceptable) return "L: ACCEPT   R: menu";
      if (activate) return `L: ${activate.doc ?? "activate"}   R: menu`;
      const primary = primaryFor();
      if (primary) {
        const name = typeof primary.label === "string" ? primary.label : primary.action;
        return `L: ${name}   R: menu`;
      }
      return "L/R: menu";
    };
    const describe = () => `${doc ?? `<${reference.type}>`}   —   ${clickDoc()}`;
    const open = (x: number, y: number, invoker: HTMLElement) => pbui.openMenu(reference, x, y, invoker);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      open(event.clientX, event.clientY, event.currentTarget as HTMLElement);
    };

    /*
     * WHEN A PRESENTATION SWALLOWS THE CLICK, AND WHEN IT LETS IT THROUGH.
     *
     * This used to open with an unconditional `event.stopPropagation()`, which
     * is correct for the two cases where the Presentation itself acts and
     * wrong for the case where the HOST does.
     *
     * `renderRow` exists so a product can wrap an organism's row content in a
     * Presentation. The Presentation then sits INSIDE the row element, so a
     * click on the label was stopped before the row's own handler ran. In
     * turboproof that meant directories stopped expanding and selection
     * stopped working the moment file rows became presentation objects; in
     * pbui's own `WithPresentation` story it means clicking a directory's
     * label selects it and does not expand it, while clicking two pixels left
     * on the indent does. The library shipped a demo of its own bug.
     *
     * A product could restore `onSelect` and `onToggle` through the activate
     * handler — turboproof did, duplicating logic the organism already had —
     * but not `setFocusedKey`, which is `useState` inside `FileBrowser` with
     * no prop and no handle. So arrow-key navigation kept moving from whatever
     * row was last focused by a NON-label click. The seam pbui built for
     * products was mutually exclusive with the organism's keyboard model.
     *
     * Now:
     *
     *   acceptable   stop. The accept flow commits; nothing else may also fire.
     *   activate     run, then LET IT BUBBLE. The host sees its own click.
     *   otherwise    stop, and open the menu. Opening a menu is this element
     *                acting, and a menu-open that also selects a row is wrong.
     *
     * The nested case is why marking beats plain bubbling. A Presentation
     * inside another Presentation previously relied on the inner one's
     * unconditional stop to keep the outer from acting too; with bubbling
     * restored, the outer would open its menu on a click meant for the inner.
     * Marking the native event lets the click reach the host — an ordinary
     * element with an ordinary handler — while any Presentation ancestor
     * ignores it. Nothing nests presentations today; the accept flow makes it
     * a natural shape (an acceptable object containing presented children),
     * and this is cheaper than finding out later.
     */
    const handleClick = (event: MouseEvent) => {
      const native = event.nativeEvent as MouseEvent["nativeEvent"] & {
        [PRESENTATION_HANDLED]?: true;
      };
      if (native[PRESENTATION_HANDLED]) return;
      native[PRESENTATION_HANDLED] = true;

      if (acceptable) {
        event.preventDefault();
        event.stopPropagation();
        pbui.satisfyAccept(reference);
        return;
      }
      if (activate) {
        // No stopPropagation: the host row's own gesture is not this
        // element's to cancel. `run` is optional precisely so a product can
        // say "the host owns this click" and still name it in the mouse doc.
        activate.run?.();
        return;
      }
      const primary = primaryFor();
      if (primary) {
        // The kernel's primary action acts like a menu row, not like
        // `activate`: this element acts, so the click stops here, and the
        // verb goes through fresh revalidation like every kernel action.
        event.preventDefault();
        event.stopPropagation();
        void pbui.performAction(primary);
        return;
      }
      event.stopPropagation();
      open(event.clientX, event.clientY, event.currentTarget as HTMLElement);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // A Presentation may wrap a real input or button. Its keystroke belongs
      // to that nested control, not to this container's activation contract.
      // Agentlogic's ChangesPanel uses the same ownership rule for rows that
      // contain their own StepChip control.
      if (event.target !== event.currentTarget) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        // The keydown never bubbles: a host with its own key handling (a tree
        // routing Enter to "open") must not also fire. What bubbles is the
        // CLICK synthesised below, which is the gesture the host is listening
        // for.
        event.stopPropagation();

        if (acceptable) {
          pbui.satisfyAccept(reference);
          return;
        }
        if (activate) {
          /*
           * Route keyboard activation through the click path rather than
           * calling `run` here.
           *
           * P4.1 made a click with `activate` bubble so the host sees its own
           * gesture, and left this branch calling `activate.run()` directly —
           * so mouse and keyboard diverged. Enter ran the presentation's verb
           * and never reached the host, and `activate` WITHOUT `run` — the
           * state a `renderRow` wrapper uses, where the host owns the click
           * entirely — was a complete keyboard no-op.
           *
           * `.click()` dispatches a real, bubbling MouseEvent, so there is one
           * activation path with one set of semantics instead of two that have
           * to be kept in step. Caught in review on PR #9.
           */
          (event.currentTarget as HTMLElement).click();
          return;
        }
        const primary = primaryFor();
        if (primary) {
          void pbui.performAction(primary);
          return;
        }
        const box = (event.target as HTMLElement).getBoundingClientRect();
        open(box.left, box.bottom, event.currentTarget as HTMLElement);
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        event.stopPropagation();
        const box = (event.target as HTMLElement).getBoundingClientRect();
        open(box.left, box.bottom, event.currentTarget as HTMLElement);
      }
    };

    return (
      <Tag
        ref={(node: Element | null) => {
          elementRef.current = node;
        }}
        className={className}
        data-pbui="presentation"
        data-part={svg ? "presentation-svg" : "presentation"}
        data-ptype={reference.type}
        data-tone={tone}
        data-state={acceptable ? "acceptable" : undefined}
        data-testid={testId}
        /* Present only while THIS element's help card is open (§13). */
        aria-describedby={helpOpenHere ? pbui.helpSurfaceId : undefined}
        /*
         * Inside a composite widget the container owns the tab stop and moves
         * focus with arrow keys, so this must not add a second one. `none`
         * removes the button semantics without removing the element.
         */
        tabIndex={inComposite ? -1 : 0}
        role={inComposite ? "none" : "button"}
        aria-label={doc ?? labelText}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onMouseEnter={(event: MouseEvent) => {
          pbui.setMouseDoc(describe());
          if (pbui.helpEnabled) scheduleHelp(event.currentTarget as Element);
        }}
        onMouseLeave={(event: MouseEvent) => {
          pbui.setMouseDoc(null);
          if (pbui.helpEnabled) {
            cancelHelpTimer();
            pbui.closeHelp(event.currentTarget as Element);
          }
        }}
        onFocus={(event: { currentTarget: Element }) => {
          pbui.setMouseDoc(describe());
          if (pbui.helpEnabled) {
            // Focus is the reliable accessible path: no delay, no timer.
            pbui.openHelp(reference, event.currentTarget, "focus");
          }
        }}
        onBlur={(event: { currentTarget: Element }) => {
          pbui.setMouseDoc(null);
          if (pbui.helpEnabled) {
            cancelHelpTimer();
            // v1 help is non-interactive, so focus can never move INTO the
            // card; blur always closes this element's help.
            pbui.closeHelp(event.currentTarget);
          }
        }}
      >
        {children}
      </Tag>
    );
  }

  function ObjectMenu() {
    const pbui = usePbui();
    const ref = useRef<HTMLDivElement>(null);

    const menu = pbui.menu;
    // The menu is the topmost thing while it is open — it can be opened from
    // inside a dialog, and its z-index says so — but it must not swallow the
    // Escape of anything that opens above it. See `surfaces.ts`.
    const ownsEscape = useEscapeSurface(menu !== null);
    useEffect(() => {
      if (!menu) return;
      const target = menu.returnFocus;
      return () => queueFocusReturn(target);
    }, [menu]);

    useEffect(() => {
      if (!menu) return;

      const handleKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          if (!ownsEscape) return;
          event.preventDefault();
          pbui.closeMenu();
        }
      };
      const handleClickAway = () => pbui.closeMenu();

      window.addEventListener("keydown", handleKey);
      window.addEventListener("click", handleClickAway);
      ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

      return () => {
        window.removeEventListener("keydown", handleKey);
        window.removeEventListener("click", handleClickAway);
      };
    }, [menu, pbui, ownsEscape]);

    if (!pbui.menu) return null;

    const { reference, x, y } = pbui.menu;
    /*
     * The menu resolves through the kernel on every render — same
     * recompute-on-render property the descriptor path had, now with
     * override, ambiguity, and trace semantics. A rendered menu is not
     * durable authority: clicking a row goes through `performAction`, which
     * re-resolves before anything is delegated.
     */
    const resolution = pbui.resolve({ subject: reference, invocation: "menu" });
    const menuActions = resolution.actions;
    const label = registry.labelFor(reference, pbui.environment);
    const left = Math.max(0, Math.min(x, window.innerWidth - 300));
    const top = Math.max(0, Math.min(y, window.innerHeight - 340));

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      }
    };

    return (
      <div
        ref={ref}
        data-pbui="menu"
        data-part="menu"
        role="menu"
        aria-label={`${reference.type} object menu`}
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header data-part="menu-header">
          {renderMenuHeader?.(reference, pbui.environment, label) ?? (
            <>
              &lt;{reference.type}&gt; {label}
            </>
          )}
        </header>
        {menuActions.length === 0 && resolution.ambiguities.length === 0 ? (
          <div data-part="menu-item">No actions available</div>
        ) : (
          menuActions.map((action) => {
            /*
             * One field still drives disabled, title, and the visible reason —
             * the `disabledBecause` invariant survived the kernel migration as
             * the `unavailable` status: present ⇔ disabled, and the string is
             * why. An unavailable action has no verb; `performAction` would
             * refuse it even if the DOM disabled attribute were bypassed.
             */
            const because =
              action.status.kind === "unavailable" ? action.status.because : undefined;
            return (
              <button
                type="button"
                role="menuitem"
                key={action.candidateId}
                data-part="menu-item"
                data-danger={action.danger || undefined}
                disabled={because !== undefined}
                title={because ?? action.description}
                onClick={() => void pbui.performAction(action)}
              >
                {action.label}
                {because && <span data-part="menu-reason"> — {because}</span>}
              </button>
            );
          })
        )}
        {resolution.ambiguities.map((ambiguity) => (
          /*
           * A tie the declarations do not decide is DATA, not a guess. The row
           * is deliberately not a button: an ambiguous action — least of all a
           * destructive one — must never execute. data-part="menu-ambiguity"
           * is its styling hook.
           */
          <div key={ambiguity.action} data-part="menu-ambiguity" role="note">
            {ambiguity.candidates.length} rules tie for {ambiguity.action} — nothing runs
          </div>
        ))}
      </div>
    );
  }

  /**
   * The mouse documentation line, straight out of Genera (PBUI-UNIFY-001,
   * DR-U2 — previously transcribed per product from datalab-ui).
   *
   * A permanently visible strip describing whatever is under the pointer and
   * stating what each button will do to it. The `aria-live` mirror is what
   * makes the self-documentation reach a screen reader; the visible copy is
   * aria-hidden so the text is not read twice. Styled by
   * `presentation-parts.css` through its data-part hooks.
   */
  function MouseDocLine({ ambient }: { ambient?: string }) {
    const pbui = usePbui();
    const mode = pbui.accepting ? "ACCEPT MODE" : "READY";
    const text =
      pbui.mouseDoc ??
      (pbui.accepting
        ? `${pbui.accepting.prompt}   (Esc aborts)`
        : "hover anything · L is the default verb · R opens its menu");
    return (
      <div data-pbui="mouse-doc" data-part="mouse-doc">
        <span data-part="mouse-doc-mode">{mode}</span>
        <span data-part="mouse-doc-text" aria-hidden="true">
          {text}
        </span>
        <VisuallyHidden live="polite">{text}</VisuallyHidden>
        {ambient && <span data-part="mouse-doc-ambient">{ambient}</span>}
      </div>
    );
  }

  /**
   * The banner shown while a command is waiting for an object (DR-U2).
   *
   * Unmissable on purpose: accept mode changes what the left mouse button
   * does to every presentation on screen, and a mode change that is not
   * advertised is a trap. It also states that the mode reaches across tiles
   * and workspaces — the non-obvious, genuinely useful part.
   *
   * A pending accept is a transient surface like any other: it must not
   * abort because a dialog opened above it took an Escape meant for the
   * dialog (the escape-surface stack in `surfaces.ts` decides ownership).
   */
  function AcceptBanner() {
    const pbui = usePbui();
    const accepting = pbui.accepting;
    const abortAccept = pbui.abortAccept;

    const ownsEscape = useEscapeSurface(accepting !== null);
    useEffect(() => {
      if (!accepting) return;
      const onKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          if (!ownsEscape) return;
          event.preventDefault();
          abortAccept();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [accepting, abortAccept, ownsEscape]);

    if (!accepting) return null;

    const wanted = Array.isArray(accepting.types)
      ? accepting.types.join(" | ")
      : String(accepting.types);

    return (
      <div
        data-pbui="accept-banner"
        data-part="accept-banner"
        role="status"
        aria-live="assertive"
      >
        <span>ACCEPTING &lt;{wanted}&gt;</span>
        <span>{accepting.prompt}</span>
        <span data-part="accept-banner-hint">works across tiles and workspaces · Esc aborts</span>
      </div>
    );
  }

  /**
   * The translator chooser (PBUI-ACTIONS-2 P6): shown when an accept click
   * matched more than one translator at equal scope and priority. A transient
   * surface like the menu — Escape dismisses the CHOOSER while the accept
   * request stays pending; focus is captured on open and restored on close;
   * the first option is focused. It never picks the first registered edge.
   */
  function AcceptChooser() {
    const pbui = usePbui();
    const ref = useRef<HTMLDivElement>(null);
    const options = pbui.acceptChooser;
    const dismiss = pbui.dismissAcceptChooser;

    const ownsEscape = useEscapeSurface(options !== null);
    useEffect(() => {
      if (!options) return;
      const target = captureFocusReturn(null);
      ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      const handleKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          if (!ownsEscape) return;
          event.preventDefault();
          dismiss();
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => {
        window.removeEventListener("keydown", handleKey);
        queueFocusReturn(target);
      };
    }, [options, dismiss, ownsEscape]);

    if (!options) return null;

    return (
      <div
        ref={ref}
        data-pbui="accept-chooser"
        data-part="accept-chooser"
        role="dialog"
        aria-label="choose how to accept this object"
      >
        <header data-part="accept-chooser-header">This object fits in more than one way</header>
        {options.map((option) => (
          <button
            type="button"
            key={option.translator ?? "direct"}
            data-part="accept-chooser-option"
            onClick={() => pbui.chooseAcceptance(option)}
          >
            {registry.labelFor(option.result, pbui.environment)}
            <span data-part="accept-chooser-via">
              {" "}
              — as &lt;{option.result.type}&gt;{option.translator ? ` via ${option.translator}` : ""}
            </span>
          </button>
        ))}
      </div>
    );
  }

  /**
   * The one hover/focus help surface (PBUI-HELP-001 §12.4), mounted once
   * beside `ObjectMenu`. Non-interactive by design: `role="tooltip"`, no
   * focusable content, never steals focus — which keeps the focus contract
   * simple (blur closes) and makes `aria-describedby` the honest relation.
   * Escape closes it through the shared surface stack, so a dialog opened
   * above keeps its own Escape. Renders nothing when help is not configured.
   */
  function ContextHelp() {
    const pbui = usePbui();
    const state = pbui.help;
    const closeHelp = pbui.closeHelp;

    const ownsEscape = useEscapeSurface(state !== null);
    useEffect(() => {
      if (!state) return;
      const handleKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          if (!ownsEscape) return;
          event.preventDefault();
          closeHelp();
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [state, closeHelp, ownsEscape]);

    if (!state || helpRendererRegistry === null) return null;

    const box = state.anchor.getBoundingClientRect();
    const left = Math.max(0, Math.min(box.left, window.innerWidth - 320));
    const top = Math.max(0, Math.min(box.bottom + 4, window.innerHeight - 60));

    return (
      <div
        id={pbui.helpSurfaceId}
        data-pbui="context-help"
        data-part="context-help"
        role="tooltip"
        style={{ left, top }}
      >
        <HelpContent
          resolution={state.resolution}
          subject={state.reference}
          snapshot={state.snapshot}
          renderers={helpRendererRegistry}
        />
      </div>
    );
  }

  return {
    Provider,
    Presentation,
    ObjectMenu,
    MouseDocLine,
    AcceptBanner,
    AcceptChooser,
    ContextHelp,
    usePbui,
    registry,
  };
}

export type PbuiInstance<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts = unknown,
> = ReturnType<typeof createPbui<Values, Environment, Verb, ProductFacts>>;

export function presentationTypes<Values extends PresentationValues>(
  ...types: readonly PresentationType<Values>[]
): readonly PresentationType<Values>[] {
  return types;
}
