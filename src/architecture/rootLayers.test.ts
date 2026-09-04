import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  analyzeRootLayers,
  CROSS_CUTTING_COMPONENT_DIRECTORIES,
  GOVERNED_COMPONENT_DIRECTORIES,
  rootLayerOf,
} from "./rootLayers";

const SOURCE_ROOT = resolve(import.meta.dirname, "..");

describe("the root PBUI source layers", () => {
  test("keep production imports inside the focused one-way component graph", () => {
    expect(analyzeRootLayers(SOURCE_ROOT)).toEqual([]);
  });

  test("register every first-level component directory", () => {
    const expected = [
      ...GOVERNED_COMPONENT_DIRECTORIES,
      ...CROSS_CUTTING_COMPONENT_DIRECTORIES,
    ].sort();
    const actual = readdirSync(join(SOURCE_ROOT, "components"))
      .filter((entry) => statSync(join(SOURCE_ROOT, "components", entry)).isDirectory())
      .sort();
    expect(actual).toEqual(expected);
  });

  test("maps component groups and top-level modules deterministically", () => {
    expect(rootLayerOf(join(SOURCE_ROOT, "components/atoms/Button/Button.tsx"), SOURCE_ROOT)).toBe(
      "components/atoms",
    );
    expect(rootLayerOf(join(SOURCE_ROOT, "components/format.ts"), SOURCE_ROOT)).toBe(
      "components/format",
    );
    expect(rootLayerOf(join(SOURCE_ROOT, "chrome/TileFrame.tsx"), SOURCE_ROOT)).toBe("chrome");
    expect(rootLayerOf("/outside/file.ts", SOURCE_ROOT)).toBeNull();
  });

  test("rejects a lower component layer importing a higher one", () => {
    const root = mkdtempSync(join(tmpdir(), "pbui-root-layers-"));
    try {
      mkdirSync(join(root, "components/foundation"), { recursive: true });
      mkdirSync(join(root, "components/atoms"), { recursive: true });
      writeFileSync(
        join(root, "components/foundation/Text.ts"),
        'import { Button } from "../atoms/Button";\nexport const value = Button;\n',
      );
      writeFileSync(join(root, "components/atoms/Button.ts"), "export const Button = {};\n");

      const violations = analyzeRootLayers(root);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain(
        "components/foundation/Text.ts (components/foundation) imports ../atoms/Button (components/atoms)",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("allows the intentional organism-to-chrome utility direction", () => {
    const root = mkdtempSync(join(tmpdir(), "pbui-root-layers-"));
    try {
      mkdirSync(join(root, "components/organisms/FileBrowser"), { recursive: true });
      mkdirSync(join(root, "chrome"), { recursive: true });
      writeFileSync(
        join(root, "components/organisms/FileBrowser/FileBrowser.ts"),
        'import { isEditableTarget } from "../../../chrome/shortcutRouting";\nvoid isEditableTarget;\n',
      );
      writeFileSync(join(root, "chrome/shortcutRouting.ts"), "export const isEditableTarget = () => false;\n");
      expect(analyzeRootLayers(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
