import { connectDocumentSource, type DocumentSource, type WorkbenchCore } from "@hyperslop-systems/workbench-core";
import type { ProgramLibrary } from "./library";

/** The format of the stub document that stands for a program in the workbench document. */
export const PROGRAM_DOCUMENT_FORMAT = "sandbox.program";

/**
 * The library as a document source: one stub per program, carrying its
 * title. The library stays the program's home (AGENT-3 guide D5): the
 * source, the bindings and the history live there, and nothing here copies
 * them. What the workbench document gets is the program's IDENTITY — a
 * document the `script` application's `program` slot can bind, because the
 * core validates every binding against the document store at its door.
 * Without it, `commands.open("script", { program: "prg-7" })` is refused
 * with `unknown_document`.
 */
export function programDocumentSource(library: ProgramLibrary): DocumentSource {
  return {
    format: PROGRAM_DOCUMENT_FORMAT,
    list: () => Object.values(library.getState().programs).map((program) => ({ id: program.id, body: { title: program.title } })),
    subscribe: (listener) => library.subscribe(listener),
  };
}

/** Mirror the library into the core's document as program stubs; the returned function disconnects. */
export function connectProgramLibrary(core: WorkbenchCore, library: ProgramLibrary): () => void {
  return connectDocumentSource(core, programDocumentSource(library));
}
