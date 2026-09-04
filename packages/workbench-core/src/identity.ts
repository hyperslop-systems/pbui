declare const localRevisionBrand: unique symbol;
declare const serverRevisionBrand: unique symbol;
declare const operationIdBrand: unique symbol;

/** Monotonic generation of installed state within one Workbench core lifetime. */
export type LocalRevision = number & { readonly [localRevisionBrand]: "LocalRevision" };

/** Opaque optimistic-concurrency token issued by a persistence server. */
export type ServerRevision = string & { readonly [serverRevisionBrand]: "ServerRevision" };

/** Identity of one idempotent operation across delivery retries. */
export type OperationId = string & { readonly [operationIdBrand]: "OperationId" };

export function localRevision(value: number): LocalRevision {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("local revision must be a non-negative safe integer");
  }
  return value as LocalRevision;
}

export function nextLocalRevision(value: LocalRevision): LocalRevision {
  return localRevision(value + 1);
}

export function serverRevision(value: string): ServerRevision {
  if (value.length === 0) throw new Error("server revision must not be empty");
  return value as ServerRevision;
}

export function operationId(value: string): OperationId {
  if (value.length === 0) throw new Error("operation id must not be empty");
  return value as OperationId;
}

/** Mint one logical operation identity; injectable so tests and replay stay deterministic. */
export function newOperationId(randomUUID: () => string = () => crypto.randomUUID()): OperationId {
  return operationId(randomUUID());
}
