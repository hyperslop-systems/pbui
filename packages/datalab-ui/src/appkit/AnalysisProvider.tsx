import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisError, AnalysisExecution } from "../analysis/types";
import { compileGraphicDocument, type Diagnostic, type GraphicDocument } from "../model/graphic";
import { compileEnvironmentForTable, rootView } from "../model/graphicAuthoring";
import type { Table } from "../model/table";
import {
  AnalysisCoordinator,
  type AnalysisExecutorLoader,
  type CoordinatedExecution,
} from "./analysisCoordinator";

/** Reviewed MVP browser result bound; independent from the 50,000-row source cap. */
export const MVP_MAX_RESULT_ROWS = 10_000;

async function loadBrowserExecutor() {
  const [{ BrowserDuckDBFactory }, { AnalysisRuntime }] = await Promise.all([
    import("../analysis/browser"),
    import("../analysis/runtime"),
  ]);
  return new AnalysisRuntime(new BrowserDuckDBFactory());
}

interface AnalysisContextValue {
  coordinator: AnalysisCoordinator;
  principalEpoch: number;
  latest: Readonly<Record<string, AnalysisExecution>>;
  publish: (documentId: string, execution: AnalysisExecution) => void;
  clear: (documentId: string) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export interface AnalysisProviderProps {
  children: ReactNode;
  /** Stable identity of the authorized principal; changing it purges all data. */
  principalKey: string;
  loadExecutor?: AnalysisExecutorLoader;
}

/** One lazy worker/database/connection owner for one React workbench root. */
export function AnalysisProvider({
  children,
  principalKey,
  loadExecutor = loadBrowserExecutor,
}: AnalysisProviderProps) {
  const coordinatorRef = useRef<AnalysisCoordinator | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new AnalysisCoordinator(loadExecutor);
  const coordinator = coordinatorRef.current;
  const previousPrincipal = useRef(principalKey);
  const [principalEpoch, setPrincipalEpoch] = useState(0);
  const [latest, setLatest] = useState<Record<string, AnalysisExecution>>({});
  const publish = useCallback((documentId: string, execution: AnalysisExecution) => {
    setLatest((current) =>
      current[documentId]?.requestId === execution.requestId
        ? current
        : { ...current, [documentId]: execution },
    );
  }, []);
  const clear = useCallback((documentId: string) => {
    setLatest((current) => {
      if (!(documentId in current)) return current;
      const next = { ...current };
      delete next[documentId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (previousPrincipal.current === principalKey) return;
    previousPrincipal.current = principalKey;
    setPrincipalEpoch((value) => value + 1);
    setLatest({});
    void coordinator.purge().catch((error: unknown) => {
      console.error("could not purge analysis runtime", error);
    });
  }, [coordinator, principalKey]);

  useEffect(
    () => () => {
      void coordinator.dispose().catch((error: unknown) => {
        console.error("could not dispose analysis runtime", error);
      });
    },
    [coordinator],
  );

  const value = useMemo(
    () => ({ coordinator, principalEpoch, latest, publish, clear }),
    [clear, coordinator, latest, principalEpoch, publish],
  );
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export type DocAnalysisState =
  | { status: "idle"; execution: null; diagnostics: Diagnostic[]; error: null }
  | {
      status: "loading";
      execution: AnalysisExecution | null;
      diagnostics: Diagnostic[];
      error: null;
    }
  | { status: "ready"; execution: AnalysisExecution; diagnostics: Diagnostic[]; error: null }
  | {
      status: "error";
      execution: AnalysisExecution | null;
      diagnostics: Diagnostic[];
      error: AnalysisError | Error;
    };

const IDLE: DocAnalysisState = {
  status: "idle",
  execution: null,
  diagnostics: [],
  error: null,
};

function asError(error: unknown): AnalysisError | Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

export function useDocAnalysis(
  document: GraphicDocument | null | undefined,
  table: Table | null | undefined,
  maxResultRows = MVP_MAX_RESULT_ROWS,
): DocAnalysisState {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error("useDocAnalysis must be used inside AnalysisProvider");
  const { coordinator, principalEpoch, publish, clear } = context;
  const [state, setState] = useState<DocAnalysisState>(IDLE);
  const invocation = useRef(0);

  const compiled = useMemo(
    () =>
      document && table
        ? compileGraphicDocument(document, compileEnvironmentForTable(document, table))
        : null,
    [document, table],
  );

  const execute = useCallback(async (): Promise<CoordinatedExecution | null> => {
    if (!document || !table || !compiled?.logical) return null;
    const view = compiled.logical.views[compiled.logical.rootView];
    if (!view) throw new Error(`compiled graphic ${document.id} has no root view`);
    const source = rootView(document).relation;
    let cursor = source;
    while (cursor.kind === "transform") {
      const transform = document.transforms[cursor.transformId];
      if (!transform) throw new Error(`missing transform ${cursor.transformId}`);
      cursor = transform.input;
    }
    return coordinator.execute({
      namespace: document.id,
      sourceId: cursor.sourceId,
      table,
      logical: compiled.logical,
      relation: view.relation,
      maxResultRows,
    });
  }, [compiled, coordinator, document, maxResultRows, table]);

  useEffect(() => {
    const current = ++invocation.current;
    if (!document || !table || !compiled) {
      setState(IDLE);
      return;
    }
    clear(document.id);
    if (!compiled.logical) {
      setState({
        status: "error",
        execution: null,
        diagnostics: compiled.diagnostics,
        error: new Error(compiled.diagnostics.map((item) => item.message).join("; ")),
      });
      return;
    }
    setState({
      status: "loading",
      execution: null,
      diagnostics: compiled.diagnostics,
      error: null,
    });
    void execute().then(
      (outcome) => {
        if (current !== invocation.current || outcome?.status !== "current") return;
        publish(document.id, outcome.execution);
        setState({
          status: "ready",
          execution: outcome.execution,
          diagnostics: compiled.diagnostics,
          error: null,
        });
      },
      (error) => {
        if (current !== invocation.current) return;
        clear(document.id);
        setState({
          status: "error",
          execution: null,
          diagnostics: compiled.diagnostics,
          error: asError(error),
        });
      },
    );
    return () => {
      invocation.current += 1;
    };
  }, [clear, compiled, document, execute, principalEpoch, publish, table]);

  return state;
}

/** Latest current result cache for synchronous PBUI descriptor resolution. */
export function useAnalysisResultFor(): (documentId: string) => AnalysisExecution | null {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error("useAnalysisResultFor must be used inside AnalysisProvider");
  const { latest } = context;
  return useCallback((documentId: string) => latest[documentId] ?? null, [latest]);
}
