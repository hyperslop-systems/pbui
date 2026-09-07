import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const guides = [
  "docs/README.md",
  "docs/guides/visual-style.md",
  "docs/guides/first-styled-workbench-panel.md",
  "docs/reference/styling-contract.md",
  "docs/playbooks/visual-review-and-storybook.md",
  "docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md",
  "docs/playbooks/refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md",
  "packages/datalab-ui/GUIDELINES.md",
];

describe("visual onboarding documentation", () => {
  it.each(guides)("keeps relative Markdown targets and code fences valid: %s", file => {
    const source = readFileSync(resolve(root, file), "utf8");
    expect(source.match(/^```/gm)?.length ?? 0).toSatisfy((n: number) => n % 2 === 0);
    // Narrow guard: inline Markdown destinations, not prose paths, code, or anchors.
    const prose = source.replace(/```[\s\S]*?```/g, "");
    for (const match of prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1]!;
      if (/^(https?:|#)/.test(target)) continue;
      expect(existsSync(resolve(dirname(resolve(root, file)), target.split("#")[0]!)), `${file}: ${target}`).toBe(true);
    }
  });
  it("routes newcomers to a compiled, storied, tested native example", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    expect(readme).toContain("docs/guides/first-styled-workbench-panel.md");
    const base = "packages/pbui-workbench/src/stories/StyledPanel/StyledPanel";
    for (const suffix of [".tsx", ".stories.tsx", ".test.tsx", ".module.css"]) expect(existsSync(resolve(root, base + suffix))).toBe(true);
    const stories = readFileSync(resolve(root, base + ".stories.tsx"), "utf8");
    for (const state of ["Default", "Empty", "Loading", "Error", "Disabled", "NarrowOverflow", "ThemeOverride", "DetailsSlot", "NativeWorkbench"]) expect(stories).toContain(`export const ${state}:`);
  });
});
