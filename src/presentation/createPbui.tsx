import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VisuallyHidden } from "../components/foundation";
import { captureFocusReturn, queueFocusReturn } from "../focus";
import { useEscapeSurface } from "../surfaces";
import { createActionRegistry } from "./actions/registry";
import type { ActionRegistry } from "./actions/registry";
import { legacyDescriptorFamily } from "./actions/legacy";
import type { LegacyFacts } from "./actions/legacy";
import { evaluateFresh } from "./actions/perform";
import { createPresentationTypeGraph } from "./actions/typeGraph";
import type {
  ActionQuery,
  PerformResult,
  ResolutionResult,
  ResolvedAction,
  SelectionSnapshot,
} from "./actions/types";
import { resolveAcceptance } from "./translators/resolve";
import type {
  AcceptanceOption,
  AcceptanceResolution,
  PresentationTranslator,
} from "./translators/types";
import type { PresentationRegistry } from "./registry";
import type {
  AcceptRequest,
  MenuState,
  PresentationConversion,
  PresentationReference,
  PresentationType,
  PresentationValues,
} from "./types";

export interface CreatePbuiOptions<
  Values extends PresentationValues,
  Environment,
  Verb,
  ProductFacts = LegacyFacts<Environment>,
> {
  registry: PresentationRegistry<Values, Environment, Verb>;
  defaultEnvironment: Environment;
  /**
   * @deprecated PBUI-ACTIONS-2: use `translators`. Conversions remain exact,
   * ordered, first-wins callbacks for products that have not migrated; they
   * are deleted with descriptor actions in the final cleanup.
   */
  conversions?: readonly PresentationConversion<Values>[];
  renderMenuHeader?: (
    reference: PresentationReference<Values>,
    environment: Environment,
    label: ReactNode,
  ) => ReactNode;
  /**
   * The action-selection kernel (PBUI-ACTIONS-2). OPTIONAL, and absence is
   * not a second engine: when a product passes no registry, `createPbui`
   * builds one internally around `legacyDescriptorFamily`, which routes the
   * descriptor `actions()` callbacks through the same resolver. One live
   * selection engine either way; the legacy path exists for one migration
   * window and is deleted with descriptor actions in the final cleanup.
   *
   * `actions` and `snapshotFor` come together: the kernel never reads live
   * stores, so a product supplying its own registry must also say how a
   * query's immutable fact snapshot is built from the environment.
   */
  actions?: ActionRegistry<Values, ProductFacts, Verb>;
  snapshotFor?(
    query: ActionQuery<Values>,
    environment: Environment,
  ): SelectionSnapshot<ProductFacts>;
  /**
   * Typed accept translators (PBUI-ACTIONS-2 P6). When present they replace
   * the `conversions` array: acceptance gains graph-subtype satisfaction
   * (the ORIGINAL reference settles the request), declared source/target/
   * scope edges instead of ordered callbacks, and explicit chooser ambiguity
   * instead of first-registered-wins. Requires `actions`/`snapshotFor` (the
   * graph and snapshots come from them). Mount `AcceptChooser` alongside
   * `AcceptBanner` — a product whose translators can tie needs the chooser
   * on screen.
   */
  translators?: readonly PresentationTranslator<Values, ProductFacts>[];
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
   */
  onPerform: (verb: Verb) => void | Promise<void>;
  onAccept?: (result: PresentationReference<Values> | null) => void;
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
   * Present ⇔ this presentation has a default verb. Absent ⇔ a left click
   * opens the object menu, like a right click.
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

  /**
   * TOMBSTONES — merged into `activate` in 0.4.0. JSX props are excess-property
   * checked, so these would already error if deleted; they are typed `never`
   * for a message that names the replacement rather than one that says the prop
   * does not exist.
   *
   * @deprecated use `activate={{ run, doc }}`
   */
  onActivate?: never;
  /** @deprecated use `activate={{ run, doc }}` */
  activateDoc?: never;
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
  ProductFacts = LegacyFacts<Environment>,
>({
  registry,
  defaultEnvironment,
  conversions = [],
  renderMenuHeader,
  actions,
  snapshotFor,
  translators,
}: CreatePbuiOptions<Values, Environment, Verb, ProductFacts>) {
  const Context = createContext<PbuiContextValue<Values, Environment, Verb> | null>(null);

  if (actions !== undefined && snapshotFor === undefined) {
    throw new Error(
      "createPbui: `actions` requires `snapshotFor` — the kernel never reads " +
        "live stores, so the product must build the query's fact snapshot",
    );
  }
  if (translators !== undefined && actions === undefined) {
    throw new Error(
      "createPbui: `translators` requires `actions` — subtype acceptance " +
        "resolves against the action registry's type graph",
    );
  }

  const EMPTY_MODES: ReadonlySet<string> = new Set();
  const EMPTY_CAPABILITIES: ReadonlySet<string> = new Set();

  // One live selection engine. Absent product options mean the internal
  // legacy pair, whose ProductFacts is LegacyFacts<Environment> — which is
  // exactly what the default type parameter says, making the casts honest.
  const actionEngine: ActionRegistry<Values, ProductFacts, Verb> =
    actions ??
    (createActionRegistry<Values, LegacyFacts<Environment>, Verb>({
      graph: createPresentationTypeGraph([]),
      scopes: ["global"],
      contributions: [
        legacyDescriptorFamily<Values, Environment, Verb>({
          id: "legacy.descriptor-actions",
          descriptors: registry,
        }),
      ],
    }) as unknown as ActionRegistry<Values, ProductFacts, Verb>);

  const snapshotOf: (
    query: ActionQuery<Values>,
    environment: Environment,
  ) => SelectionSnapshot<ProductFacts> =
    snapshotFor ??
    ((_query, environment) =>
      ({
        revision: 0,
        scopes: ["global"],
        modes: EMPTY_MODES,
        capabilities: EMPTY_CAPABILITIES,
        product: { environment },
      }) as SelectionSnapshot<LegacyFacts<Environment>> as SelectionSnapshot<ProductFacts>);

  function acceptedReference(
    request: AcceptRequest<Values>,
    reference: PresentationReference<Values>,
  ): PresentationReference<Values> | undefined {
    const wanted = Array.isArray(request.types) ? request.types : [request.types];
    if (wanted.includes(reference.type)) {
      return !request.filter || request.filter(reference) ? reference : undefined;
    }

    for (const convert of conversions) {
      const converted = convert(reference);
      if (!converted || !wanted.includes(converted.type)) continue;
      if (!request.filter || request.filter(converted)) return converted;
    }
    return undefined;
  }

  const EMPTY_PREDICATES = new Map<string, never>();

  /**
   * One resolution for highlighting AND clicking. Products with translators
   * get the typed path (graph subtyping, declared edges, chooser ambiguity);
   * products still on `conversions` keep today's exact-then-ordered behavior
   * wrapped in the same result shape.
   */
  function acceptanceFor(
    request: AcceptRequest<Values>,
    reference: PresentationReference<Values>,
    environment: Environment,
  ): AcceptanceResolution<Values> {
    if (translators !== undefined) {
      const snapshot = snapshotOf({ subject: reference, invocation: "accept" }, environment);
      return resolveAcceptance(
        { graph: actionEngine.graph, translators, predicates: EMPTY_PREDICATES },
        request,
        reference,
        snapshot,
      );
    }
    const converted = acceptedReference(request, reference);
    return converted
      ? { kind: "accepted", option: { translator: null, result: converted } }
      : { kind: "none" };
  }

  function Provider({
    children,
    environment = defaultEnvironment,
    onPerform,
    onAccept,
  }: PbuiProviderProps<Values, Environment, Verb>) {
    const [accepting, setAccepting] = useState<AcceptRequest<Values> | null>(null);
    const [acceptChooser, setAcceptChooser] = useState<readonly AcceptanceOption<Values>[] | null>(
      null,
    );
    const [menu, setMenu] = useState<MenuState<Values> | null>(null);
    const [mouseDoc, setMouseDoc] = useState<string | null>(null);
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
        openMenu: (reference, x, y, invoker) => setMenu({ reference, x, y, returnFocus: captureFocusReturn(invoker) }),
        closeMenu: () => setMenu(null),
        acceptChooser,
        chooseAcceptance: (option) => settle(option.result),
        dismissAcceptChooser: () => setAcceptChooser(null),
        mouseDoc,
        setMouseDoc,
        perform: (verb) => {
          setMenu(null);
          return onPerform(verb);
        },
        resolve: (query) => actionEngine.resolve(query, snapshotOf(query, environment)),
        performAction: async (stale) => {
          setMenu(null);
          const fresh = actionEngine.resolve(stale.query, snapshotOf(stale.query, environment));
          const decision = evaluateFresh(stale, fresh);
          if (decision.kind !== "proceed") return decision;
          try {
            // Called synchronously within the click segment; the fresh verb,
            // never the stale one.
            await onPerform(decision.verb);
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
        settle,
        onPerform,
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
    const tone = registry.toneFor(reference);
    const label = registry.labelFor(reference, pbui.environment);
    const labelText =
      typeof label === "string" || typeof label === "number" ? String(label) : reference.type;
    const Tag = svg ? "g" : block ? "div" : "span";

    const clickDoc = acceptable
      ? "L: ACCEPT   R: menu"
      : activate
        ? `L: ${activate.doc ?? "activate"}   R: menu`
        : "L/R: menu";
    const describe = () => `${doc ?? `<${reference.type}>`}   —   ${clickDoc}`;
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
        className={className}
        data-pbui="presentation"
        data-part={svg ? "presentation-svg" : "presentation"}
        data-ptype={reference.type}
        data-tone={tone}
        data-state={acceptable ? "acceptable" : undefined}
        data-testid={testId}
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
        onMouseEnter={() => pbui.setMouseDoc(describe())}
        onMouseLeave={() => pbui.setMouseDoc(null)}
        onFocus={() => pbui.setMouseDoc(describe())}
        onBlur={() => pbui.setMouseDoc(null)}
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

  return {
    Provider,
    Presentation,
    ObjectMenu,
    MouseDocLine,
    AcceptBanner,
    AcceptChooser,
    usePbui,
    registry,
  };
}

export type PbuiInstance<
  Values extends PresentationValues,
  Environment,
  Verb,
> = ReturnType<typeof createPbui<Values, Environment, Verb>>;

export function presentationTypes<Values extends PresentationValues>(
  ...types: readonly PresentationType<Values>[]
): readonly PresentationType<Values>[] {
  return types;
}
