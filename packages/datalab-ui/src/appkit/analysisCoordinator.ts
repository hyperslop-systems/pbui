import type { AnalysisExecution, AnalysisRequest } from "../analysis/types";

export interface AnalysisExecutor {
  execute(request: AnalysisRequest): Promise<AnalysisExecution>;
  purge(): Promise<void>;
  dispose(): Promise<void>;
}

export type AnalysisExecutorLoader = () => Promise<AnalysisExecutor>;

export type CoordinatedExecution =
  | { status: "current"; execution: AnalysisExecution }
  | { status: "stale"; execution: AnalysisExecution };

export interface AnalysisCoordinatorMetrics {
  executions: number;
  cacheHits: number;
  coalesced: number;
  staleDrops: number;
}

const MAX_CACHED_EXECUTIONS = 32;

/**
 * Owns one lazily-created executor and the latest-generation rule for every
 * document namespace. It contains no React state so lifecycle races can be
 * tested without a DOM.
 */
export class AnalysisCoordinator {
  private executor: AnalysisExecutor | null = null;
  private loading: Promise<AnalysisExecutor> | null = null;
  private namespaces = new Map<string, { generation: number; semanticKey: string }>();
  private inFlight = new Map<string, Promise<AnalysisExecution>>();
  private completed = new Map<string, AnalysisExecution>();
  private epoch = 0;
  private disposed = false;
  private sourceIds = new WeakMap<object, number>();
  private nextSourceId = 0;
  private counters: AnalysisCoordinatorMetrics = {
    executions: 0,
    cacheHits: 0,
    coalesced: 0,
    staleDrops: 0,
  };

  constructor(private readonly load: AnalysisExecutorLoader) {}

  sourceKey(table: object, sourceId: string): string {
    let identity = this.sourceIds.get(table);
    if (identity === undefined) {
      identity = ++this.nextSourceId;
      this.sourceIds.set(table, identity);
    }
    return `${sourceId}@${identity}`;
  }

  metrics(): Readonly<AnalysisCoordinatorMetrics> {
    return { ...this.counters };
  }

  private async getExecutor(): Promise<AnalysisExecutor> {
    if (this.disposed) throw new Error("analysis coordinator is disposed");
    if (this.executor) return this.executor;
    if (!this.loading) {
      this.loading = this.load().then((executor) => {
        this.executor = executor;
        return executor;
      });
    }
    try {
      return await this.loading;
    } finally {
      this.loading = null;
    }
  }

  async execute(
    request: Omit<AnalysisRequest, "requestId" | "generation" | "sourceKey"> & {
      sourceKey?: string;
    },
  ): Promise<CoordinatedExecution> {
    if (this.disposed) throw new Error("analysis coordinator is disposed");
    const sourceKey = request.sourceKey ?? this.sourceKey(request.table, request.sourceId);
    const semanticKey = JSON.stringify([
      sourceKey,
      request.logical,
      request.relation,
      request.maxResultRows,
    ]);
    const previous = this.namespaces.get(request.namespace);
    const generation =
      previous?.semanticKey === semanticKey ? previous.generation : (previous?.generation ?? 0) + 1;
    this.namespaces.set(request.namespace, { generation, semanticKey });
    const epoch = this.epoch;

    let execution = this.completed.get(semanticKey);
    if (execution) {
      this.counters.cacheHits += 1;
      // Refresh insertion order for the small LRU.
      this.completed.delete(semanticKey);
      this.completed.set(semanticKey, execution);
    } else {
      let pending = this.inFlight.get(semanticKey);
      if (pending) {
        this.counters.coalesced += 1;
      } else {
        this.counters.executions += 1;
        pending = this.getExecutor().then((executor) =>
          executor.execute({
            ...request,
            requestId: crypto.randomUUID(),
            generation,
            sourceKey,
          }),
        );
        this.inFlight.set(semanticKey, pending);
        void pending.then(
          (completed) => {
            if (!this.disposed && epoch === this.epoch) {
              this.completed.set(semanticKey, completed);
              while (this.completed.size > MAX_CACHED_EXECUTIONS) {
                const oldest = this.completed.keys().next().value;
                if (oldest === undefined) break;
                this.completed.delete(oldest);
              }
            }
          },
          () => undefined,
        );
        const clearPending = () => {
          if (this.inFlight.get(semanticKey) === pending) this.inFlight.delete(semanticKey);
        };
        void pending.then(clearPending, clearPending);
      }
      execution = await pending;
    }
    const current =
      !this.disposed &&
      epoch === this.epoch &&
      this.namespaces.get(request.namespace)?.generation === generation &&
      this.namespaces.get(request.namespace)?.semanticKey === semanticKey;
    if (!current) this.counters.staleDrops += 1;
    return { status: current ? "current" : "stale", execution };
  }

  async purge(): Promise<void> {
    if (this.disposed) return;
    this.epoch += 1;
    this.namespaces.clear();
    this.inFlight.clear();
    this.completed.clear();
    this.sourceIds = new WeakMap<object, number>();
    this.nextSourceId = 0;
    const executor = this.executor ?? (this.loading ? await this.loading : null);
    await executor?.purge();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.epoch += 1;
    this.namespaces.clear();
    this.inFlight.clear();
    this.completed.clear();
    const executor = this.executor ?? (this.loading ? await this.loading : null);
    await executor?.dispose();
    this.executor = null;
  }
}
