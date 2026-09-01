import { defaultKeymap, deleteLine, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { diagnostics } from "./diagnostics";
import { pbuiEditorStyle } from "./theme";

export type EditorLanguage = "javascript" | "json" | "plain";

/** The language extension for a `language` prop value. `plain` is no grammar at all. */
export function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case "javascript":
      return javascript({ typescript: false, jsx: false });
    case "json":
      return json();
    case "plain":
      return [];
  }
}

/**
 * The default keymap, minus `deleteLine`.
 *
 * `Mod+Shift+K` is `deleteLine` in @codemirror/commands and "open the
 * rebalance dialog" in @hyperslop-systems/pbui-workbench, whose listener is on
 * `window` in the CAPTURE phase and calls `preventDefault()`
 * (`packages/pbui-workbench/src/components/Launcher/Launcher.tsx`). The
 * workbench wins and the editor never sees the key, so leaving the binding in
 * place produces a chord that looks bound and does nothing. Removing it makes
 * the behaviour honest; `Mod+K` (the launcher) is not bound by CodeMirror at
 * all and needs no treatment. See `src/chrome/shortcutRouting.ts` in pbui for
 * the route table.
 */
export const pbuiKeymap = defaultKeymap.filter((binding) => binding.run !== deleteLine);

export interface BaseExtensionOptions {
  lineNumbers: boolean;
  /** Mod+Enter. Bound only when given. */
  onRun?: (view: EditorView) => void;
}

/**
 * Everything that does not change over the editor's life. The things that do
 * — language, read-only, the run handler — live in Compartments owned by the
 * component so a prop change is a reconfigure rather than a remount.
 */
export function baseExtensions(options: BaseExtensionOptions): Extension {
  return [
    options.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : [],
    highlightActiveLine(),
    drawSelection(),
    history(),
    bracketMatching(),
    indentOnInput(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(2),
    keymap.of([...pbuiKeymap, ...historyKeymap, indentWithTab]),
    diagnostics(),
    pbuiEditorStyle,
    EditorView.lineWrapping,
  ];
}

/**
 * The `Mod+Enter` binding for a run handler, as an extension a Compartment
 * can hold.
 *
 * `Prec.highest`, because `defaultKeymap` already binds `Mod-Enter` to
 * `insertBlankLine` and keymaps are consulted in precedence order: without
 * this the base map handles the chord first, returns true, and the run
 * handler is never asked. Found by the test, not by reading the keymap.
 */
export function runKeymap(onRun: ((view: EditorView) => void) | undefined): Extension {
  if (!onRun) return [];
  return Prec.highest(
    keymap.of([
      {
        key: "Mod-Enter",
        run: (view) => {
          onRun(view);
          return true;
        },
      },
    ]),
  );
}
