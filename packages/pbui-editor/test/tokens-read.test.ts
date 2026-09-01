import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every `--pbui-*` token the editor reads must have a default in pbui's
 * `src/tokens.css`. The core package's own `tokens-defined` guard scans only
 * CSS; this package's theme is JavaScript (`EditorView.theme`), so it needs
 * its own check or a typo here renders as no colour, silently.
 */
const HERE = join(__dirname, "..");
const TOKENS = readFileSync(join(HERE, "../../src/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function defined(): Set<string> {
  return new Set([...TOKENS.matchAll(/(--pbui-[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
}

function read(source: string): Set<string> {
  return new Set([...source.matchAll(/var\((--pbui-[a-z0-9-]+)\)/g)].map((m) => m[1] as string));
}

describe("tokens the editor reads", () => {
  it.each(["src/theme.ts", "src/CodeEditor/CodeEditor.module.css"])("%s reads only defined tokens", (file) => {
    const source = readFileSync(join(HERE, file), "utf8");
    const missing = [...read(source)].filter((t) => !defined().has(t) && t !== "--pbui-editor-rows");
    expect(missing).toEqual([]);
  });
});
