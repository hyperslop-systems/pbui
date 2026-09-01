import "./styles.css";

export { CodeEditor } from "./CodeEditor";
export type { CodeEditorProps } from "./CodeEditor";
export type { EditorDiagnostic, EditorDiagnosticSeverity } from "./diagnostics";
export { setDiagnostics, currentDiagnostics } from "./diagnostics";
export type { EditorLanguage } from "./extensions";
export { pbuiKeymap } from "./extensions";
export { pbuiEditorTheme, pbuiHighlightStyle, pbuiEditorStyle } from "./theme";

/*
 * CodeMirror is bundled into this package (see vite.config.ts), so a consumer
 * that needs the view class — a test reading the document behind a mounted
 * editor, an extension author — must use THIS copy; a separately installed
 * @codemirror/view would be a second instance and its extensions would be
 * "Unrecognized extension value" to ours.
 */
export { EditorView } from "@codemirror/view";
export { EditorState, Compartment, Prec } from "@codemirror/state";
