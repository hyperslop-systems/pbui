import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * One folder per component (pbui playbook §6a): `Name/Name.tsx` with an
 * `index.ts`, a `Name.module.css` only when it has styles, and a story
 * beside it. Component files that live loose in a directory fail here.
 */
const SRC = resolve(import.meta.dirname, "../src");

/** Files that are not components: factories, registries, contexts, entry points. */
const NOT_COMPONENTS = new Set([
  "createPbuiChat.tsx",
  "context.tsx",
  "widget/definitions.tsx",
  "tools/acceptTool.tsx",
  "tools/proposeTool.tsx",
  "apps/createChatApps.tsx",
  "apps/createConversationApps.tsx",
  // Providers and hosts, not components: they render contexts, not pixels.
  "conversations/ActiveConversationScope.tsx",
  "conversations/ConversationHost.tsx",
  "conversations/ConversationScope.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === "generated" || entry === "stories") continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const TSX = walk(SRC).filter((f) => f.endsWith(".tsx") && !/\.(stories|test)\.tsx$/.test(f));

describe("one folder per component", () => {
  test("every component lives in a folder of its own name with an index.ts", () => {
    const violations: string[] = [];
    for (const file of TSX) {
      const rel = relative(SRC, file);
      if (NOT_COMPONENTS.has(rel)) continue;
      const name = basename(file, ".tsx");
      const folder = basename(join(file, ".."));
      if (folder !== name) {
        violations.push(`${rel}: expected to live in a folder named ${name}/`);
        continue;
      }
      if (!existsSync(join(file, "..", "index.ts"))) violations.push(`${rel}: missing index.ts`);
    }
    expect(violations).toEqual([]);
  });

  test("every component story folder has a story or is listed as story-free", () => {
    const STORY_FREE = new Set(["RefPresentation", "WidgetChild", "MessageRow", "ToolCard", "AcceptStatus", "StatChild", "LogChild", "TableChild", "FormChild", "VerbChips", "ChatInspectorPanel", "WatchlistPanel", "TilesPanel", "TracePanel", "Messages", "ConversationsTile", "EventsTile", "RunsTile", "ToolsTile", "ContextTile"]);
    const missing: string[] = [];
    for (const file of TSX) {
      const rel = relative(SRC, file);
      if (NOT_COMPONENTS.has(rel)) continue;
      const name = basename(file, ".tsx");
      if (STORY_FREE.has(name)) continue;
      if (!existsSync(join(file, "..", `${name}.stories.tsx`))) missing.push(rel);
    }
    expect(missing).toEqual([]);
  });
});
