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

export interface PresentationProps<Values extends PresentationValues> {
  reference: PresentationReference<Values>;
  children: ReactNode;
  className?: string;
  doc?: string;
  svg?: boolean;
  block?: boolean;
  onActivate?: () => void;
  activateDoc?: string;
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
    onActivate,
    activateDoc,
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
      : onActivate
        ? `L: ${activateDoc ?? "activate"}   R: menu`
        : "L/R: menu";
    const describe = () => `${doc ?? `<${reference.type}>`}   —   ${clickDoc}`;
    const open = (x: number, y: number) => pbui.openMenu(reference, x, y);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      open(event.clientX, event.clientY);
    };

    const handleClick = (event: MouseEvent) => {
      event.stopPropagation();
      if (acceptable) {
        event.preventDefault();
        pbui.satisfyAccept(reference);
      } else if (onActivate) {
        onActivate();
      } else {
        open(event.clientX, event.clientY);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        if (acceptable) pbui.satisfyAccept(reference);
        else if (onActivate) onActivate();
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
        tabIndex={0}
        role="button"
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
