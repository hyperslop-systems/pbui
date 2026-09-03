import { create } from "@bufbuild/protobuf";
import { Button, Callout, EmptyState, Text, TextArea, Toolbar } from "@hyperslop-systems/pbui";
import { useWorkbench, type AppProps } from "@hyperslop-systems/pbui-workbench";
import { DocumentPayloadSchema, MutationSchema, type AppView, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./NotesApp.module.css";

/**
 * The binding key: `view.documents.note` names the payload in
 * `WorkbenchDocument.documents` this tile edits. Exported for the same reason
 * as `SKU_BINDING` — a second string literal is how "go to the existing
 * note" turns into "open an empty second one".
 */
export const NOTE_BINDING = "note";

/** What the payload's `format`/`schema_version` say. A reader that finds another format leaves the note alone. */
export const NOTE_FORMAT = "pbui.note";
export const NOTE_SCHEMA_VERSION = 1;

/*
 * ---- why this tile is debounced AND capped -------------------------------
 *
 * The demo persists the WHOLE workbench document to localStorage whenever it
 * changes (see demo/src/workbench.ts `createLocalPersistence`). So one
 * keystroke here is not one small write: it re-serialises every workspace,
 * every split ratio and every view, and hands the result to localStorage on
 * the main thread. The package's 250 ms trailing window softens a burst; it
 * does not make the payload smaller, which is what the cap below is for.
 *
 * Both numbers below defend the same failure, which is worse than slowness.
 * localStorage has a per-origin quota (5–10 MB in practice) and a quota
 * failure or a half-written entry leaves a string that `parseDocument` cannot
 * read. `parseDocument` returns `null` on anything it cannot parse, and
 * workbench.ts falls back to `defaultLayout()` — so a note that grew too
 * large does not lose the NOTE, it silently resets the user's ENTIRE layout
 * back to the four default tiles, with no message. The cap keeps one note far
 * below any plausible quota; the debounce keeps the number of whole-document
 * writes proportional to sentences typed rather than characters.
 */
const SAVE_DEBOUNCE_MS = 500;
const MAX_NOTE_CHARS = 4000;

export function noteTitle(view: AppView): string {
  if (view.title) return view.title;
  const id = view.documents[NOTE_BINDING] ?? "";
  return id ? `notes · ${id}` : "notes";
}

interface NoteBody {
  text: string;
  updatedAt: string;
}

/**
 * Read a note out of the workbench document. A missing payload is a NOTE THAT
 * DOES NOT EXIST YET, not an error: `openView("notes", {note: "n-gold-desk"})`
 * binds an id before anything has been typed, and the first edit is what
 * creates the payload.
 */
export function readNote(document: WorkbenchDocument, id: string): NoteBody {
  const payload = document.documents[id];
  if (!payload || payload.format !== NOTE_FORMAT) return { text: "", updatedAt: "" };
  const body = payload.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { text: "", updatedAt: "" };
  const record = body as Record<string, unknown>;
  return {
    text: typeof record.text === "string" ? record.text : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

/**
 * A scratchpad whose text lives in `WorkbenchDocument.documents` — the half of
 * the workbench protocol nothing else in this product exercises.
 *
 * That is the whole reason it exists: the layout half (`views`, `nodes`,
 * `workspaces`) is proved by every other tile, while `documentPut` and
 * `documentDelete`, the payload map and the applier's `document_in_use` guard
 * had no caller at all. It also gives the agent something to DO with a
 * research answer: `workbench_open_tile{appId:"notes", documents:{note:…}}`
 * with the answer already written into the payload.
 */
export function NotesApp({ view }: AppProps) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const noteId = view.documents[NOTE_BINDING] ?? "";
  const stored = readNote(document, noteId);

  const [draft, setDraft] = useState(stored.text);
  const [refused, setRefused] = useState(false);
  /** The last text this tile committed; the fence that stops a save loop and a re-seed loop. */
  const written = useRef(stored.text);
  const owed = useRef<{ id: string; text: string } | null>(null);

  const save = useCallback(
    (id: string, text: string) => {
      workbench.apply([
        create(MutationSchema, {
          body: {
            case: "documentPut",
            value: {
              document: create(DocumentPayloadSchema, {
                id,
                format: NOTE_FORMAT,
                schemaVersion: NOTE_SCHEMA_VERSION,
                body: { text, updatedAt: new Date().toISOString() },
              }),
            },
          },
        }),
      ]);
      written.current = text;
      owed.current = null;
    },
    [workbench],
  );

  // Re-seed from the document when the payload changed under us — the tile was
  // rebound to another note, or the AGENT wrote one. Fenced on `written` so a
  // save we just made does not bounce back and stomp the caret.
  useEffect(() => {
    if (stored.text !== written.current) {
      written.current = stored.text;
      owed.current = null;
      setDraft(stored.text);
    }
  }, [noteId, stored.text]);

  useEffect(() => {
    if (!noteId || draft === written.current) return undefined;
    owed.current = { id: noteId, text: draft };
    const timer = setTimeout(() => save(noteId, draft), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, noteId, save]);

  // A tile closed mid-sentence must not eat the sentence: the debounce timer
  // dies with the component, so whatever it still owed is committed here.
  const flush = useRef<() => void>(() => {});
  useEffect(() => {
    flush.current = () => {
      if (owed.current) save(owed.current.id, owed.current.text);
    };
  });
  useEffect(() => () => flush.current(), []);

  if (!noteId) {
    return (
      <div className={styles.app}>
        <EmptyState message="this tile names no note" hint="ask the agent to open a note, or bind one from the launcher" />
      </div>
    );
  }

  const lines = draft === "" ? 0 : draft.split("\n").length;

  return (
    <div data-part="notes-app" className={styles.app}>
      <TextArea
        accessibleName={`note ${noteId}`}
        value={draft}
        onValueChange={(next) => {
          setRefused(false);
          // Capped HERE rather than at save time: capping in `save` would leave
          // `draft` permanently longer than `written`, and the debounce effect
          // would then fire a whole-document write on every render, forever.
          setDraft(next.slice(0, MAX_NOTE_CHARS));
        }}
        maxLength={MAX_NOTE_CHARS}
        className={styles.editor}
        rows={10}
        placeholder="reorder 2049 before Friday"
      />

      {refused && (
        <Callout variant="warning" title="the workbench kept the note">
          <Text size="tiny" prose>
            `documentDelete` was refused because a view still binds this payload — the applier's `document_in_use`
            guard. Close every notes tile bound to <code>{noteId}</code> first; the console line carries the code and
            the path.
          </Text>
        </Callout>
      )}

      <Toolbar tight>
        <Text size="tiny" tone="faint">
          {stored.updatedAt ? `saved ${clockOf(stored.updatedAt)}` : "not saved yet"} · {lines} line{lines === 1 ? "" : "s"} ·{" "}
          {draft.length}/{MAX_NOTE_CHARS}
        </Text>
        <span className={styles.spacer} />
        {/* Deliberately reachable while this very tile binds the payload: the
            refusal IS the demonstration. */}
        <Button
          size="tiny"
          tone="danger"
          disabled={!stored.updatedAt}
          onClick={() => {
            owed.current = null;
            const gone = workbench.apply([
              create(MutationSchema, { body: { case: "documentDelete", value: { documentId: noteId } } }),
            ]);
            setRefused(!gone);
            if (gone) {
              written.current = "";
              setDraft("");
            }
          }}
        >
          Discard note
        </Button>
      </Toolbar>
    </div>
  );
}

/** `2026-08-20T14:22:03Z` → `14:22`. An unparseable stamp reads as "saved" with no time rather than "Invalid Date". */
function clockOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}
