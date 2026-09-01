import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/**
 * The editor's look, expressed entirely through pbui tokens.
 *
 * Every colour and font here is a `var(--pbui-*)` read, never a literal, so the
 * editor follows a product's own `:root` overrides exactly as every other pbui
 * component does. The six `--pbui-syntax-*` tokens are defined in pbui's
 * `src/tokens.css` (PBUI-PLOTKIT-1) — defining them locally would be the
 * silent-undefined-token failure that file exists to end.
 *
 * `test/tokens-read.test.ts` asserts every token this file reads has a
 * default there, because the core `tokens-defined` guard only scans CSS and
 * this theme is JavaScript.
 */
export const pbuiEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--pbui-code-surface)",
    color: "var(--pbui-code-text)",
    fontSize: "var(--pbui-fs-small)",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "var(--pbui-font)",
    lineHeight: "var(--pbui-lh-tight)",
  },
  ".cm-content": {
    caretColor: "var(--pbui-ink)",
    padding: "var(--pbui-space-1) 0",
  },
  "&.cm-focused": {
    outline: "var(--pbui-focus-ring)",
    outlineOffset: "var(--pbui-focus-offset)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--pbui-code-surface)",
    color: "var(--pbui-faint)",
    border: "none",
    borderRight: "var(--pbui-border-hair)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--pbui-pane)",
    color: "var(--pbui-ink)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--pbui-pane)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--pbui-ink)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      backgroundColor: "var(--pbui-selected)",
    },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    outline: "var(--pbui-border-hair)",
    backgroundColor: "transparent",
  },
  ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    outline: "1px dashed var(--pbui-danger)",
    backgroundColor: "transparent",
  },
  // The diagnostic gutter marker and the underline it points at.
  ".cm-pbui-diagnostic-error": {
    textDecoration: "underline dashed var(--pbui-danger)",
    textUnderlineOffset: "3px",
  },
  ".cm-pbui-diagnostic-warning": {
    textDecoration: "underline dashed var(--pbui-syntax-number)",
    textUnderlineOffset: "3px",
  },
  ".cm-pbui-diagnostic-info": {
    textDecoration: "underline dotted var(--pbui-faint)",
    textUnderlineOffset: "3px",
  },
  ".cm-pbui-diagnostic-line": {
    backgroundColor: "color-mix(in srgb, var(--pbui-danger) 8%, transparent)",
  },
  ".cm-pbui-gutter-marker": {
    color: "var(--pbui-danger)",
    fontWeight: "700",
    paddingLeft: "var(--pbui-space-1)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--pbui-pane)",
    color: "var(--pbui-ink)",
    border: "var(--pbui-border-hair)",
    borderRadius: "var(--pbui-radius)",
    fontFamily: "var(--pbui-font)",
    fontSize: "var(--pbui-fs-tiny)",
  },
});

export const pbuiHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword], color: "var(--pbui-syntax-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--pbui-syntax-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--pbui-syntax-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--pbui-syntax-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--pbui-syntax-function)", fontWeight: "600" },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: "var(--pbui-syntax-property)" },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "var(--pbui-faint)" },
  { tag: [t.definition(t.variableName)], color: "var(--pbui-ink)" },
]);

/** Theme + highlighting, as one extension. */
export const pbuiEditorStyle = [pbuiEditorTheme, syntaxHighlighting(pbuiHighlightStyle)];
