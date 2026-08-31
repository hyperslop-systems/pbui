import { describe, expect, test } from "vitest";
import {
  HELP_MIN_CARD,
  HELP_VIEWPORT_MARGIN,
  placeHelpCard,
} from "./place";

/** PBUI-HELP-002 intern guide §5 rules and §6 I5 (containment) as a property. */

const viewport = { width: 1280, height: 800 };

describe("placement rules", () => {
  test("fits below: flush under the anchor, capped to the space below", () => {
    const p = placeHelpCard(
      { left: 100, top: 100, right: 220, bottom: 124 },
      { width: 320, height: 200 },
      viewport,
    );
    expect(p).toEqual({
      left: 100,
      top: 124, // flush — no gap, ever (round-3 finding is load-bearing)
      maxHeight: 800 - 124 - HELP_VIEWPORT_MARGIN,
      side: "below",
    });
  });

  test("flips above when below cannot fit and above wins", () => {
    const anchor = { left: 100, top: 700, right: 220, bottom: 724 };
    const p = placeHelpCard(anchor, { width: 320, height: 280 }, viewport);
    expect(p.side).toBe("above");
    // Bottom edge flush against the anchor's top.
    expect(p.top + Math.min(280, p.maxHeight)).toBe(anchor.top);
    expect(p.maxHeight).toBeGreaterThanOrEqual(280);
  });

  test("anchor at the very bottom still yields a usable scrolling sliver", () => {
    // Tiny space on BOTH sides: stays below with the MIN_CARD floor.
    const p = placeHelpCard(
      { left: 40, top: 10, right: 90, bottom: 780 },
      { width: 320, height: 280 },
      { width: 1280, height: 800 },
    );
    expect(p.maxHeight).toBeGreaterThanOrEqual(HELP_MIN_CARD);
    // The card may cover the anchor in this pathological case, but it stays
    // inside the viewport — reachability beats adjacency at the extremes.
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(800);
  });

  test("horizontal clamp keeps the card inside the right edge", () => {
    const p = placeHelpCard(
      { left: 1200, top: 100, right: 1260, bottom: 124 },
      { width: 320, height: 100 },
      viewport,
    );
    expect(p.left).toBe(1280 - 320);
  });
});

describe("I5 — containment property over random rectangles", () => {
  function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  test("card stays inside the viewport and flush when adjacency is possible", () => {
    const random = rng(0x91ace);
    for (let i = 0; i < 2000; i += 1) {
      const vw = 400 + Math.floor(random() * 1600);
      const vh = 300 + Math.floor(random() * 1200);
      const aw = 10 + Math.floor(random() * 300);
      const ah = 10 + Math.floor(random() * 80);
      const left = Math.floor(random() * (vw - aw));
      const top = Math.floor(random() * (vh - ah));
      const anchor = { left, top, right: left + aw, bottom: top + ah };
      const card = {
        width: 200 + Math.floor(random() * 200),
        height: 40 + Math.floor(random() * 400),
      };
      const p = placeHelpCard(anchor, card, { width: vw, height: vh });
      const label = `case ${i}: vp ${vw}x${vh} anchor ${JSON.stringify(anchor)} card ${JSON.stringify(card)} -> ${JSON.stringify(p)}`;

      const renderedHeight = Math.min(card.height, p.maxHeight);
      expect(p.left, label).toBeGreaterThanOrEqual(0);
      expect(p.left + Math.min(card.width, vw), label).toBeLessThanOrEqual(vw);
      expect(p.top, label).toBeGreaterThanOrEqual(0);
      expect(p.top + renderedHeight, label).toBeLessThanOrEqual(vh);
      expect(p.maxHeight, label).toBeGreaterThanOrEqual(Math.min(HELP_MIN_CARD, vh));

      // Flush whenever the placement is not the pathological floor case.
      if (p.side === "below" && p.maxHeight > HELP_MIN_CARD) {
        expect(p.top, label).toBe(anchor.bottom);
      }
      if (p.side === "above" && renderedHeight === card.height) {
        expect(p.top + renderedHeight, label).toBe(anchor.top);
      }
    }
  });
});
