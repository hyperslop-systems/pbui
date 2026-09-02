import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HelpContent } from "../components/ContextHelp";
import type { HelpRendererRegistry } from "../components/ContextHelp";
import { VisuallyHidden } from "../components/foundation";
import { captureFocusReturn, isRestoringFocus, queueFocusReturn } from "../focus";
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
import { helpSurfaceStep, initialHelpSurfaceState } from "./help/machine";
import type {
  HelpSurfaceDeps,
  HelpSurfaceEvent,
  HelpSurfaceState,
} from "./help/machine";
import { placeHelpCard } from "./help/place";
import type { HelpRegistry } from "./help/registry";
import type { HelpResolution } from "./help/types";
import { SNAPSHOT_INPUT } from "./kernel/types";
import type { PresentationKernel, SnapshotInput } from "./kernel/types";
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

interface CreatePbuiCommonOptions<
  Values extends PresentationValues,
  Environment,
> {
  defaultEnvironment: Environment;
  renderMenuHeader?: (
    reference: PresentationReference<Values>,
    environment: Environment,
    label: ReactNode,
  ) => ReactNode;
  helpRenderers?: HelpRendererRegistry;
}

/** Compatibility assembly retained while products migrate to one kernel. */
export interface LegacyCreatePbuiOptions<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts,
> extends CreatePbuiCommonOptions<Values, Environment> {
  registry: PresentationDescriptorRegistry<Values, Environment>;
  actions: ActionRegistry<Values, ProductFacts, Verb>;
  snapshotFor(
    query: ActionQuery<Values>,
    environment: Environment,
  ): SelectionSnapshot<ProductFacts>;
  translators?: readonly PresentationTranslator<Values, ProductFacts>[];
  help?: HelpRegistry<Values, ProductFacts>;
}

/** Preferred assembly: one declaration-built kernel plus product facts. */
export interface KernelCreatePbuiOptions<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts,
> extends CreatePbuiCommonOptions<Values, Environment> {
  kernel: PresentationKernel<Values, Environment, ProductFacts, Verb>;
  factsFor(
    query: ActionQuery<Values>,
    environment: Environment,
  ): ProductFacts | SnapshotInput<ProductFacts>;
}

export type CreatePbuiOptions<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts,
> =
  | LegacyCreatePbuiOptions<Values, Environment, Verb, ProductFacts>
  | KernelCreatePbuiOptions<Values, Environment, Verb, ProductFacts>;

function isSnapshotInput<ProductFacts>(
  value: ProductFacts | SnapshotInput<ProductFacts>,
): value is SnapshotInput<ProductFacts> {
  return (
    typeof value === "object" &&
    value !== null &&
    SNAPSHOT_INPUT in value &&
    value[SNAPSHOT_INPUT] === true
  );
}

/** How long the pointer rests on a presentation before its help opens. */
const HELP_POINTER_DELAY_MS = 350;

/*
 * FOCUS opens help only for KEYBOARD focus — the :focus-visible idea, tracked
 * by hand because jsdom cannot test the pseudo-class and browsers disagree on
 * programmatic focus. Without this, closing the object menu reopened help:
 * the menu returns focus to its invoker (`queueFocusReturn`), that focus event
 * hit the help path, and the card a pointer gesture never asked for sat open
 * until the next hover. A pointer click on the presentation itself had the
 * same defect in miniature — focus-follows-click opened help instantly,
 * bypassing the rest delay.
 *
 * Module state, like the escape-surface stack in surfaces.ts and for the same
 * reason: input modality is a property of the whole page, not of one provider
 * subtree. Listeners install once, on the first help-enabled Provider mount.
 */
let lastInputWasKeyboard = false;
let inputModalityTracked = false;
function trackInputModality(): void {
  if (inputModalityTracked || typeof window === "undefined") return;
  inputModalityTracked = true;
  window.addEventListener(
    "keydown",
    () => {
      lastInputWasKeyboard = true;
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    () => {
      lastInputWasKeyboard = false;
    },
    true,
  );
}

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

export interface PbuiRefusal<Values extends PresentationValues> {
  readonly code: string;
  readonly because?: string;
  readonly action?: string;
  readonly candidateId?: string;
  readonly subject?: PresentationReference<Values>;
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
  /** Fresh-revalidation refusals; absent preserves the legacy silent behavior. */
  onRefuse?(refusal: PbuiRefusal<Values>): void;
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
   * Contextual help (PBUI-HELP-001, consolidated by PBUI-HELP-002). ALL
   * open/close/arm policy lives in the pure `helpSurfaceStep` machine
   * (src/presentation/help/machine.ts — see the HELP-002 intern guide for
   * the transition table and fuzzed invariants). Components translate DOM
   * facts into `HelpSurfaceEvent`s and dispatch; they hold no policy.
   * `helpEnabled` is static for a pbui instance: false means handlers skip
   * dispatching entirely. `help` is the derived view of the machine's
   * `open` state; resolution stays lazy by construction — the machine calls
   * its injected resolver only inside timer-fired and keyboard-focus
   * transitions.
   */
  helpEnabled: boolean;
  help: PbuiHelpState<Values, unknown> | null;
  helpSurfaceId: string;
  helpDispatch(event: HelpSurfaceEvent<Values>): void;
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
>(options: CreatePbuiOptions<Values, Environment, Verb, ProductFacts>) {
  const Context = createContext<PbuiContextValue<Values, Environment, Verb> | null>(null);
  const { defaultEnvironment, renderMenuHeader, helpRenderers } = options;
  const kernelEngine = "kernel" in options ? options.kernel : null;
  const registry =
    kernelEngine?.descriptors ??
    (options as LegacyCreatePbuiOptions<Values, Environment, Verb, ProductFacts>).registry;
  const actionEngine =
    kernelEngine?.actions ??
    (options as LegacyCreatePbuiOptions<Values, Environment, Verb, ProductFacts>).actions;
  const translators =
    "kernel" in options ? [] : options.translators ?? [];
  const helpEngine =
    kernelEngine?.help ?? ("kernel" in options ? null : options.help ?? null);
  const snapshotOf = (
    query: ActionQuery<Values>,
    environment: Environment,
  ): SelectionSnapshot<ProductFacts> => {
    if ("kernel" in options) {
      const produced = options.factsFor(query, environment);
      return isSnapshotInput(produced)
        ? options.kernel.snapshot(produced.facts, produced.options)
        : options.kernel.snapshot(produced);
    }
    return options.snapshotFor(query, environment);
  };
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
    return kernelEngine
      ? kernelEngine.accept(request, reference, snapshot)
      : resolveAcceptance(
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
    onRefuse,
  }: PbuiProviderProps<Values, Environment, Verb>) {
    const [accepting, setAccepting] = useState<AcceptRequest<Values> | null>(null);
    const [acceptChooser, setAcceptChooser] = useState<readonly AcceptanceOption<Values>[] | null>(
      null,
    );
    const [menu, setMenu] = useState<MenuState<Values> | null>(null);
    const [mouseDoc, setMouseDoc] = useState<string | null>(null);
    const helpSurfaceId = useId();
    useEffect(() => {
      if (helpEnabled) trackInputModality();
    }, []);

    /*
     * The help surface machine (PBUI-HELP-002). The deps ref carries the
     * CURRENT environment into the pure step function; laziness is
     * structural — the machine calls resolve only in its two lazy
     * transitions, so no gesture-free render ever resolves rules.
     */
    const helpDepsRef = useRef<HelpSurfaceDeps<Values, ProductFacts>>({ resolve: () => null });
    helpDepsRef.current = {
      resolve: (reference) => {
        if (!helpEngine) return null;
        const snapshot = snapshotOf(
          { subject: reference, invocation: "introspection" },
          environment,
        );
        const resolution = helpEngine.resolve(reference, snapshot);
        return resolution.items.length === 0 ? null : { resolution, snapshot };
      },
    };
    const [helpSurface, setHelpSurface] = useState<HelpSurfaceState<Values, ProductFacts>>(
      initialHelpSurfaceState,
    );
    const helpDispatch = useCallback((event: HelpSurfaceEvent<Values>) => {
      setHelpSurface((state) => helpSurfaceStep(state, event, helpDepsRef.current));
    }, []);

    /*
     * Effects as state sync: exactly ONE timer, provider-owned, running iff
     * the machine is armed. Re-arming on a new anchor restarts it via the
     * cleanup; menu-opened disarming cancels it the same way — an armed
     * timeout can no longer outlive anything (PR #20 round 4).
     */
    const armed = helpSurface.surface.kind === "armed" ? helpSurface.surface : null;
    useEffect(() => {
      if (armed === null) return;
      const timer = setTimeout(
        () => helpDispatch({ type: "timer-fired", anchor: armed.anchor }),
        HELP_POINTER_DELAY_MS,
      );
      return () => clearTimeout(timer);
    }, [armed, helpDispatch]);

    /*
     * The menu mirror is an effect on the ACTUAL menu state, so every path
     * that closes the menu — closeMenu, perform, performAction, accept —
     * is covered without instrumenting any of them.
     */
    const menuOpen = menu !== null;
    useEffect(() => {
      helpDispatch({ type: menuOpen ? "menu-opened" : "menu-closed" });
    }, [menuOpen, helpDispatch]);
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
          // The menu supersedes the hover card AND any pending arm — the
          // machine's menu-opened transition handles both, driven by the
          // menu mirror effect above.
          setMenu({ reference, x, y, returnFocus: captureFocusReturn(invoker) });
        },
        closeMenu: () => setMenu(null),
        acceptChooser,
        chooseAcceptance: (option) => settle(option.result),
        dismissAcceptChooser: () => setAcceptChooser(null),
        mouseDoc,
        setMouseDoc,
        helpEnabled,
        help:
          helpSurface.surface.kind === "open"
            ? {
                reference: helpSurface.surface.reference,
                resolution: helpSurface.surface.resolution,
                snapshot: helpSurface.surface.snapshot,
                anchor: helpSurface.surface.anchor,
                trigger: helpSurface.surface.trigger,
              }
            : null,
        helpSurfaceId,
        helpDispatch,
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
          if (decision.kind !== "proceed") {
            onRefuse?.({
              code: decision.code,
              ...(decision.because !== undefined ? { because: decision.because } : {}),
              action: stale.action,
              candidateId: stale.candidateId,
              subject: stale.query.subject,
            });
            return decision;
          }
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
        helpSurface,
        helpSurfaceId,
        helpDispatch,
        settle,
        onPerform,
        onRefuse,
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
     * Contextual help (PBUI-HELP-001 §12.3, machine per PBUI-HELP-002): the
     * EXISTING enter/leave and focus/blur handlers DISPATCH surface events —
     * no wrapper element, so SVG, table, and composite markup stay valid,
     * and no policy lives here: classification only (relatedTarget → into,
     * modality flags → keyboard/restoring). When help is not configured no
     * event is dispatched and the handlers behave exactly as before.
     */
    /*
     * Holds the LAST rendered element and survives the ref callback's
     * detach-with-null on unmount — the unmount dispatch below needs the
     * element identity after React has already handed the ref null.
     */
    const elementRef = useRef<Element | null>(null);
    /*
     * Unmount tells the machine (PR #20 review): a virtualized row can drop
     * with the card open and no leave/blur ever firing. The machine's
     * `unmounted` transition clears only a surface anchored to THIS element.
     * The hover timer itself is provider-owned and machine-synced now — no
     * per-presentation timer exists to clean up.
     */
    const helpDispatchStable = pbui.helpDispatch;
    const helpEnabledStable = pbui.helpEnabled;
    useEffect(
      () => () => {
        const element = elementRef.current;
        if (helpEnabledStable && element) {
          helpDispatchStable({ type: "unmounted", anchor: element });
        }
      },
      [helpDispatchStable, helpEnabledStable],
    );

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
          // Keep the last element through the null detach; see elementRef.
          if (node !== null) elementRef.current = node;
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
          if (pbui.helpEnabled) {
            pbui.helpDispatch({
              type: "pointer-enter",
              anchor: event.currentTarget as Element,
              reference,
            });
          }
        }}
        onMouseLeave={(event: MouseEvent) => {
          pbui.setMouseDoc(null);
          if (pbui.helpEnabled) {
            // Classification, not policy: leaving INTO the card is a
            // different event than leaving elsewhere; the machine decides
            // what each means.
            const into = event.relatedTarget as Element | null;
            pbui.helpDispatch({
              type: "pointer-leave",
              anchor: event.currentTarget as Element,
              into:
                into instanceof Element && into.closest('[data-pbui="context-help"]')
                  ? "card"
                  : "elsewhere",
            });
          }
        }}
        onFocus={(event: { currentTarget: Element }) => {
          pbui.setMouseDoc(describe());
          if (pbui.helpEnabled) {
            // Stamp the platform facts here, at the adapter edge; the
            // machine's focus row does the rest (keyboard focus opens,
            // pointer-borne and RESTORED focus stay silent).
            pbui.helpDispatch({
              type: "focus",
              anchor: event.currentTarget,
              reference,
              keyboard: lastInputWasKeyboard,
              restoring: isRestoringFocus(),
            });
          }
        }}
        onBlur={(event: { currentTarget: Element }) => {
          pbui.setMouseDoc(null);
          if (pbui.helpEnabled) {
            pbui.helpDispatch({ type: "blur", anchor: event.currentTarget });
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
    const helpDispatch = pbui.helpDispatch;
    const cardRef = useRef<HTMLDivElement>(null);

    const ownsEscape = useEscapeSurface(state !== null);
    useEffect(() => {
      if (!state) return;
      const handleKey = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          if (!ownsEscape) return;
          event.preventDefault();
          helpDispatch({ type: "escape" });
          return;
        }
        /*
         * Keyboard-opened help must keep overflowing content reachable
         * (PR #20 review): the tooltip is not focusable, so PageDown/PageUp
         * page the card while it is open. Pointer-opened help keeps the
         * keys — a hover card must not hijack page scrolling; the wheel
         * scrolls it instead.
         */
        if (state.trigger === "focus" && (event.key === "PageDown" || event.key === "PageUp")) {
          const card = cardRef.current;
          if (!card) return;
          event.preventDefault();
          const delta = card.clientHeight || 200;
          card.scrollTop += event.key === "PageDown" ? delta : -delta;
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [state, helpDispatch, ownsEscape]);

    /*
     * Placement (PBUI-HELP-002 §5): measure the RENDERED card, then let the
     * pure geometry decide — flush against the anchor (a gap closes the card
     * mid-crossing), flipped above when below cannot fit, height capped to
     * the space that actually exists so overflow is reachable, never a flat
     * clamp. The stylesheet's max-height stays the OUTER bound (PR #20
     * round 5): placement may only shrink the card below it, never grow past
     * it, so a roomy viewport still gets the compact scrolling card the
     * theme configured. Runs pre-paint, so the initial 0,0 render is never
     * visible.
     */
    useLayoutEffect(() => {
      if (!state) return;
      const card = cardRef.current;
      if (!card) return;
      // Drop the previous placement's inline cap so the themable stylesheet
      // bound — not last time's geometry — is what getComputedStyle reports.
      card.style.maxHeight = "";
      const styleCap = Number.parseFloat(getComputedStyle(card).maxHeight);
      const outerCap = Number.isFinite(styleCap) ? styleCap : Number.POSITIVE_INFINITY;
      const placement = placeHelpCard(
        state.anchor.getBoundingClientRect(),
        { width: card.offsetWidth || 320, height: Math.min(card.scrollHeight || 0, outerCap) },
        { width: window.innerWidth, height: window.innerHeight },
      );
      card.style.left = `${placement.left}px`;
      card.style.top = `${placement.top}px`;
      card.style.maxHeight = `${Math.min(placement.maxHeight, outerCap)}px`;
      card.dataset.side = placement.side;
    }, [state]);

    if (!state || helpRendererRegistry === null) return null;

    return (
      <div
        ref={cardRef}
        id={pbui.helpSurfaceId}
        data-pbui="context-help"
        data-part="context-help"
        role="tooltip"
        style={{ left: 0, top: 0 }}
        onMouseLeave={(event) => {
          // The pointer wandered in to scroll; the machine decides what
          // leaving toward the anchor or elsewhere means.
          const to = event.relatedTarget as Element | null;
          helpDispatch({
            type: "card-leave",
            into: to instanceof Element && state.anchor.contains(to) ? "anchor" : "elsewhere",
          });
        }}
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
    kernel: kernelEngine,
  };
}

/**
 * The instance type as consumers that do not know the product's facts name
 * it (pbui-chat takes `PbuiInstance<Values, Environment, Verb>`). The facts
 * parameter appears only in invariant positions (predicates read it), so the
 * facts-agnostic spelling must default to `any`, not `unknown` — with
 * `unknown` no concrete instance is assignable to it.
 */
export type PbuiInstance<
  Values extends PresentationValues,
  Environment,
  Verb,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ProductFacts = any,
> = ReturnType<typeof createPbui<Values, Environment, Verb, ProductFacts>>;

export function presentationTypes<Values extends PresentationValues>(
  ...types: readonly PresentationType<Values>[]
): readonly PresentationType<Values>[] {
  return types;
}
