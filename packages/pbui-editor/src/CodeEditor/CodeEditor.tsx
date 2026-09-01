import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useLayoutEffect, useRef } from "react";
import { type EditorDiagnostic, setDiagnostics } from "../diagnostics";
import { baseExtensions, type EditorLanguage, languageExtension, runKeymap } from "../extensions";
import styles from "./CodeEditor.module.css";

export interface CodeEditorProps {
  value: string;
  onValueChange(value: string): void;
  /** Becomes `aria-label`. Say what the document holds — follows `TextArea`. */
  accessibleName: string;
  /** Default `"javascript"`. */
  language?: EditorLanguage;
  readOnly?: boolean;
  /** Default true. */
  lineNumbers?: boolean;
  diagnostics?: readonly EditorDiagnostic[];
  /** `Mod+Enter`. Omit to leave the chord unbound. */
  onRun?(value: string): void;
  /**
   * Lines of visible content when the container does not size the editor.
   * Omit to fill the container (the tile case).
   */
  rows?: number;
  className?: string;
}

const EMPTY: readonly EditorDiagnostic[] = [];

/**
 * A CodeMirror 6 editor as a controlled React component.
 *
 * The API mirrors `TextArea` from `@hyperslop-systems/pbui` on purpose:
 * `value` + `onValueChange(value)` rather than an event, a required
 * `accessibleName` that becomes `aria-label`, and `rows` in lines of content.
 * A call site moving from one to the other changes the import and adds
 * `language`.
 *
 * CodeMirror owns its own DOM and state; React must not fight it. The bridge is
 * four rules: create the view once on mount; when `value` differs from the
 * document, replace the document (and ONLY then — an unconditional replace on
 * every render maps the selection through a full replacement and puts the
 * cursor at 0 on every keystroke); report user edits through an update
 * listener; destroy on unmount. Everything a prop can change at runtime —
 * language, read-only, the run chord — sits in a `Compartment` so the change
 * is a `reconfigure` effect rather than a remount that would lose undo history
 * and scroll position.
 *
 * On `no-raw-controls`: pbui's test forbids a raw `<textarea>` outside
 * `atoms/`. CodeMirror's surface is a `contenteditable` div, not a form
 * control, and this package is the one place it lives — the same argument that
 * made `TextArea` an atom applies, and this component is its answer for code.
 */
export function CodeEditor({
  value,
  onValueChange,
  accessibleName,
  language = "javascript",
  readOnly = false,
  lineNumbers = true,
  diagnostics = EMPTY,
  onRun,
  rows,
  className,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // The latest callbacks, read by the listener without re-creating the view.
  const onValueChangeRef = useRef(onValueChange);
  const onRunRef = useRef(onRun);
  onValueChangeRef.current = onValueChange;
  onRunRef.current = onRun;

  const compartments = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    run: new Compartment(),
  });

  // Mount once. `lineNumbers` is deliberately mount-time only: the gutter is
  // part of the base extension set and nothing toggles it live.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const c = compartments.current;
    const state = EditorState.create({
      doc: value,
      extensions: [
        baseExtensions({ lineNumbers }),
        c.language.of(languageExtension(language)),
        c.readOnly.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        c.run.of(runKeymap(onRun ? (v) => onRunRef.current?.(v.state.doc.toString()) : undefined)),
        EditorView.contentAttributes.of({ "aria-label": accessibleName, "aria-multiline": "true", role: "textbox" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onValueChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount-time only by design; see the comment above and the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The controlled-value rule, with its guard.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.current.language.reconfigure(languageExtension(language)) });
  }, [language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.current.readOnly.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  // Bound or unbound follows whether a handler exists; the handler itself is
  // read through the ref so a new closure per render does not reconfigure.
  const hasRun = onRun !== undefined;
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.current.run.reconfigure(runKeymap(hasRun ? (v) => onRunRef.current?.(v.state.doc.toString()) : undefined)),
    });
  }, [hasRun]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setDiagnostics.of(diagnostics) });
  }, [diagnostics]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.contentDOM.setAttribute("aria-label", accessibleName);
  }, [accessibleName]);

  return (
    <div
      ref={hostRef}
      data-part="code-editor"
      data-language={language}
      data-readonly={readOnly || undefined}
      className={[styles.root, rows === undefined ? styles.fill : "", className ?? ""].filter(Boolean).join(" ")}
      style={rows === undefined ? undefined : ({ "--pbui-editor-rows": rows } as React.CSSProperties)}
    />
  );
}
