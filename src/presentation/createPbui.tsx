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
import { useEscapeSurface } from "../surfaces";
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
> {
  registry: PresentationRegistry<Values, Environment, Verb>;
  defaultEnvironment: Environment;
  conversions?: readonly PresentationConversion<Values>[];
  renderMenuHeader?: (
    reference: PresentationReference<Values>,
    environment: Environment,
    label: ReactNode,
  ) => ReactNode;
}

export interface PbuiProviderProps<
  Values extends PresentationValues,
  Environment,
  Verb,
> {
  children: ReactNode;
  environment?: Environment;
  onPerform?: (verb: Verb) => void | Promise<void>;
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
  openMenu(reference: PresentationReference<Values>, x: number, y: number): void;
  closeMenu(): void;
  mouseDoc: string | null;
  setMouseDoc(text: string | null): void;
  perform(verb: Verb): void | Promise<void>;
}

export function createPbui<Values extends PresentationValues, Environment, Verb>({
  registry,
  defaultEnvironment,
  conversions = [],
  renderMenuHeader,
}: CreatePbuiOptions<Values, Environment, Verb>) {
  const Context = createContext<PbuiContextValue<Values, Environment, Verb> | null>(null);

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

  function Provider({
    children,
    environment = defaultEnvironment,
    onPerform,
    onAccept,
  }: PbuiProviderProps<Values, Environment, Verb>) {
    const [accepting, setAccepting] = useState<AcceptRequest<Values> | null>(null);
    const [menu, setMenu] = useState<MenuState<Values> | null>(null);
    const [mouseDoc, setMouseDoc] = useState<string | null>(null);
    const pending = useRef<
      ((result: PresentationReference<Values> | null) => void) | null
    >(null);

    const settle = useCallback((result: PresentationReference<Values> | null) => {
      const resolve = pending.current;
      pending.current = null;
      setAccepting(null);
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

    const isAcceptable = useCallback(
      (reference: PresentationReference<Values>) =>
        accepting !== null && acceptedReference(accepting, reference) !== undefined,
      [accepting],
    );

    const satisfyAccept = useCallback(
      (reference: PresentationReference<Values>) => {
        if (!accepting) return;
        const accepted = acceptedReference(accepting, reference);
        if (accepted) settle(accepted);
      },
      [accepting, settle],
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
        openMenu: (reference, x, y) => setMenu({ reference, x, y }),
        closeMenu: () => setMenu(null),
        mouseDoc,
        setMouseDoc,
        perform: (verb) => {
          setMenu(null);
          return onPerform?.(verb);
        },
      }),
      [
        environment,
        accepting,
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
    const open = (x: number, y: number) => pbui.openMenu(reference, x, y);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      open(event.clientX, event.clientY);
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
      open(event.clientX, event.clientY);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        if (acceptable) pbui.satisfyAccept(reference);
        else if (activate) activate.run?.();
        else {
          const box = (event.target as HTMLElement).getBoundingClientRect();
          open(box.left, box.bottom);
        }
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        event.stopPropagation();
        const box = (event.target as HTMLElement).getBoundingClientRect();
        open(box.left, box.bottom);
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
    const actions = registry.actionsFor(reference, pbui.environment);
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
        {actions.length === 0 ? (
          <div data-part="menu-item">No actions available</div>
        ) : (
          actions.map((action) => (
            <button
              type="button"
              role="menuitem"
              key={action.id}
              data-part="menu-item"
              data-danger={action.danger || undefined}
              /*
               * Every one of these reads ONE field, and that is the point.
               *
               * P2 fixed this render by guarding the reason on `disabled`
               * rather than on the reason existing. P3.1 removed the guard's
               * reason to exist: with `disabledBecause` merged, the field being
               * set MEANS disabled, so there is nothing left to disagree.
               *
               * That collapse is the test for whether a merge was real. If the
               * downstream guards had multiplied instead of disappearing, the
               * two fields would still have been two concepts wearing one name.
               */
              disabled={action.disabledBecause !== undefined}
              title={action.disabledBecause ?? action.description}
              onClick={() => pbui.perform(action.verb)}
            >
              {action.label}
              {action.disabledBecause && (
                <span data-part="menu-reason"> — {action.disabledBecause}</span>
              )}
            </button>
          ))
        )}
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

  return {
    Provider,
    Presentation,
    ObjectMenu,
    MouseDocLine,
    AcceptBanner,
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
