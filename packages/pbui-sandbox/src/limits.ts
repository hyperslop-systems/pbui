/**
 * Bounds on untrusted, model-written programs. The first group is enforced by
 * every engine (the validators count); the second only by an engine that can
 * interrupt (QuickJS) — `eval` cannot stop a synchronous loop on its own
 * thread, and the guide (§5.11) says so rather than pretending.
 */
export interface SandboxLimits {
  /** Bytes of a program's source. */
  sourceBytes: number;
  /** Programs the library holds. */
  programs: number;
  /** Actions the library holds. */
  actions: number;
  /** Serialised bytes of the whole library. */
  libraryBytes: number;
  /** Nodes in one rendered tree. */
  treeNodes: number;
  /** Nesting depth of one rendered tree. */
  treeDepth: number;
  /** Characters in one text/badge node. */
  textChars: number;
  /** Rows in one table node. */
  tableRows: number;
  /** Intents one handler call may emit. */
  intentsPerEvent: number;

  /* QuickJS only. */
  memoryBytes: number;
  stackBytes: number;
  loadMs: number;
  renderMs: number;
  eventMs: number;
  /** One REPL line; generous, because a line may render several times. */
  evaluateMs: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  sourceBytes: 64 * 1024,
  programs: 64,
  actions: 64,
  libraryBytes: 1024 * 1024,
  treeNodes: 2000,
  treeDepth: 16,
  textChars: 4096,
  tableRows: 500,
  intentsPerEvent: 16,

  memoryBytes: 32 * 1024 * 1024,
  stackBytes: 1024 * 1024,
  loadMs: 1000,
  renderMs: 100,
  eventMs: 100,
  evaluateMs: 1000,
};

export function withLimits(overrides: Partial<SandboxLimits> = {}): SandboxLimits {
  return { ...DEFAULT_LIMITS, ...overrides };
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
