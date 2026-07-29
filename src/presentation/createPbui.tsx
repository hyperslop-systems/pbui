import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
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
}

export interface PbuiProviderProps<Environment, Verb> {
  children: ReactNode;
  environment?: Environment;
  onPerform?: (verb: Verb) => void | Promise<void>;
}

export interface PresentationProps<Values extends PresentationValues> {
  reference: PresentationReference<Values>;
  children?: ReactNode;
  className?: string;
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
  perform(verb: Verb): void | Promise<void>;
}

export function createPbui<Values extends PresentationValues, Environment, Verb>({
  registry,
  defaultEnvironment,
  conversions = [],
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
  }: PbuiProviderProps<Environment, Verb>) {
    const [accepting, setAccepting] = useState<AcceptRequest<Values> | null>(null);
    const [menu, setMenu] = useState<MenuState<Values> | null>(null);
    const pending = useRef<
      ((result: PresentationReference<Values> | null) => void) | null
    >(null);

    const settle = useCallback((result: PresentationReference<Values> | null) => {
      const resolve = pending.current;
      pending.current = null;
      setAccepting(null);
      resolve?.(result);
    }, []);

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
        perform: (verb) => {
          setMenu(null);
          return onPerform?.(verb);
        },
      }),
      [environment, accepting, accept, isAcceptable, satisfyAccept, menu, settle, onPerform],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function usePbui(): PbuiContextValue<Values, Environment, Verb> {
    const context = useContext(Context);
    if (!context) throw new Error("PBUI components must be rendered inside their Provider");
    return context;
  }

  function Presentation({ reference, children, className }: PresentationProps<Values>) {
    const pbui = usePbui();
    const acceptable = pbui.isAcceptable(reference);
    const tone = registry.toneFor(reference);
    const label = registry.labelFor(reference, pbui.environment);

    const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      pbui.openMenu(reference, event.clientX, event.clientY);
    };

    return (
      <button
        type="button"
        className={className}
        data-pbui="presentation"
        data-part="presentation"
        data-presentation-type={reference.type}
        data-tone={tone}
        data-acceptable={acceptable || undefined}
        onClick={() => {
          if (acceptable) pbui.satisfyAccept(reference);
        }}
        onContextMenu={handleContextMenu}
      >
        {children ?? label}
      </button>
    );
  }

  function ObjectMenu() {
    const pbui = usePbui();
    if (!pbui.menu) return null;

    const { reference, x, y } = pbui.menu;
    const actions = registry.actionsFor(reference, pbui.environment);

    return (
      <div
        data-pbui="object-menu"
        data-part="object-menu"
        role="menu"
        style={{ left: x, top: y }}
      >
        <header data-part="object-menu-header">
          {registry.labelFor(reference, pbui.environment)}
        </header>
        {actions.length === 0 ? (
          <div data-part="object-menu-empty">No actions available</div>
        ) : (
          actions.map((action) => (
            <button
              type="button"
              role="menuitem"
              key={action.id}
              data-part="object-menu-action"
              data-danger={action.danger || undefined}
              disabled={action.disabled}
              title={action.disabledReason ?? action.description}
              onClick={() => pbui.perform(action.verb)}
            >
              {action.label}
            </button>
          ))
        )}
        <button
          type="button"
          data-part="object-menu-close"
          aria-label="Close menu"
          onClick={pbui.closeMenu}
        >
          Close
        </button>
      </div>
    );
  }

  return {
    Provider,
    Presentation,
    ObjectMenu,
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
