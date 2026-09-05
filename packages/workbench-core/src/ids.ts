import type { IdGenerator } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Preview purity (design doc 04 §5.5, §6.7). A plan mints ids for the views
 * and nodes it creates. When preview and execute drew from one shared
 * generator, a preview consumed ids the following execute could no longer
 * mint, so "what would happen" and "what happened" disagreed on every id.
 *
 * The pool keeps a lookahead per prefix: a plan reads ids from the buffer
 * (refilling it from the configured generator as it goes), and only a plan
 * that is COMMITTED consumes what it read. A preview, or an execution
 * refused after planning, leaves the buffer as it found it — so the next
 * plan reads the same ids. Deterministic generators keep their sequence,
 * random ones cost nothing.
 */
export interface PlanIds {
  /** The generator a plan uses; every call reads the next buffered id for the prefix. */
  readonly ids: IdGenerator;
  /** Consume what this plan read; call once, after installing the plan's transition. */
  commit(): void;
}

export interface IdPool {
  fork(): PlanIds;
}

export function createIdPool(generator: IdGenerator): IdPool {
  const buffers = new Map<string, string[]>();
  const bufferOf = (prefix: string) => {
    let buffer = buffers.get(prefix);
    if (!buffer) {
      buffer = [];
      buffers.set(prefix, buffer);
    }
    return buffer;
  };
  return {
    fork() {
      const read = new Map<string, number>();
      return {
        ids: (prefix) => {
          const buffer = bufferOf(prefix);
          const position = read.get(prefix) ?? 0;
          while (buffer.length <= position) buffer.push(generator(prefix));
          read.set(prefix, position + 1);
          return buffer[position]!;
        },
        commit() {
          for (const [prefix, count] of read) bufferOf(prefix).splice(0, count);
          read.clear();
        },
      };
    },
  };
}
