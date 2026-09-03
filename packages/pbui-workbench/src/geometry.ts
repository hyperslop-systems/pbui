import { DEFAULT_DIVIDER_PX, type GeometrySnapshot, type Rect } from "@hyperslop-systems/workbench-core";

/**
 * DOM → `GeometrySnapshot` (guide §11.1, S10): the shell's one job with the
 * DOM that the engine used to do itself. Measured immediately before a
 * geometry-dependent command and passed to `execute`; never stored.
 *
 * Returns null when there is no mounted Surface or it has no area (jsdom,
 * a hidden tab): the engine then uses its deterministic headless fallbacks,
 * which is the honest answer rather than a snapshot full of zeros.
 */
export function measureGeometry(root: HTMLElement | null): GeometrySnapshot | null {
  if (!root || typeof root.getBoundingClientRect !== "function") return null;
  const box = root.getBoundingClientRect();
  const rectOf = (element: Element): Rect => {
    const r = element.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height };
  };
  const placements = new Map<string, Rect>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-placement-id]")) {
    const id = element.dataset.placementId;
    if (id) placements.set(id, rectOf(element));
  }
  const splits = new Map<string, Rect>();
  let inline: number | null = null;
  let block: number | null = null;
  for (const element of root.querySelectorAll<HTMLElement>("[data-split-id]")) {
    const id = element.dataset.splitId;
    if (!id) continue;
    splits.set(id, rectOf(element));
    // The rendered divider track, measured once per axis from the first split that has one.
    const divider = Array.from(element.children).find((child) => (child as HTMLElement).dataset?.part === "split-divider") as HTMLElement | undefined;
    const measured = divider?.getBoundingClientRect();
    if (measured) {
      if (inline === null && measured.width > 0 && measured.width < measured.height) inline = measured.width;
      if (block === null && measured.height > 0 && measured.height < measured.width) block = measured.height;
    }
  }
  const token = dividerToken(root);
  const viewport = box.width > 0 && box.height > 0 ? { x: 0, y: 0, width: box.width, height: box.height } : undefined;
  if (!viewport && placements.size === 0) return null;
  return {
    ...(viewport ? { viewport } : {}),
    divider: { inline: inline ?? token, block: block ?? token },
    placements,
    splits,
  };
}

function dividerToken(root: HTMLElement): number {
  if (typeof getComputedStyle !== "function") return DEFAULT_DIVIDER_PX;
  const token = Number.parseFloat(getComputedStyle(root).getPropertyValue("--pbui-space-4"));
  return Number.isFinite(token) && token >= 0 ? token : DEFAULT_DIVIDER_PX;
}

/**
 * Geometry for ONE split — the divider's own refresh and pointer path, where
 * measuring every tile per pointer move would be waste. The split's element
 * and its rendered divider are all the engine's ratio math reads.
 */
export function measureSplitGeometry(element: HTMLElement | null, splitId: string): GeometrySnapshot | null {
  if (!element || typeof element.getBoundingClientRect !== "function") return null;
  const box = element.getBoundingClientRect();
  if (!Number.isFinite(box.width) || box.width <= 0 || box.height <= 0) return null;
  const divider = Array.from(element.children).find((child) => (child as HTMLElement).dataset?.part === "split-divider") as HTMLElement | undefined;
  const measured = divider?.getBoundingClientRect();
  const token = dividerToken(element);
  const inline = measured && measured.width > 0 && measured.width < measured.height ? measured.width : token;
  const block = measured && measured.height > 0 && measured.height < measured.width ? measured.height : token;
  return {
    divider: { inline, block },
    placements: new Map(),
    splits: new Map([[splitId, { x: 0, y: 0, width: box.width, height: box.height }]]),
  };
}
