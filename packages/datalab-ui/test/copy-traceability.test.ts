import { describe, expect, test } from "vitest";
import { PRODUCT } from "../src/components/pages/MarketingPage/copy";
import { STEP_KINDS } from "../src/components/organisms/PipelinePanel/PipelinePanel";

/**
 * The marketing page operates under one rule: a claim must name something a
 * reader could go and find. Two of its claims are ENUMERATIONS, and an
 * enumeration goes stale mechanically — the previous copy shipped three
 * runtime claims that were true of a prototype and false of this product.
 * This test makes the rule executable for the claim most likely to rot: the
 * transform vocabulary.
 *
 * If this fails because a transform kind was added: update the PRODUCT card
 * body in copy.ts to name it, then update the word map here. The failure
 * lands in the copy, which is the correct place to be forced to edit.
 */
describe("copy traceability", () => {
  test("the visible-pipeline card names every transform kind, and only those", () => {
    // The display word each kind appears under in the card's prose.
    const wordFor: Record<(typeof STEP_KINDS)[number], string> = {
      filter: "Filters",
      derive: "derives",
      summarize: "summaries",
      sort: "sorts",
      limit: "limits",
    };

    const body = PRODUCT.cards.find((card) => card.n === "01")?.body ?? "";
    for (const kind of STEP_KINDS) {
      expect(body, `the card must name the ${kind} transform`).toContain(wordFor[kind]);
    }

    // Five kinds is what the copy asserts; a sixth must update the sentence.
    expect(STEP_KINDS).toHaveLength(Object.keys(wordFor).length);
  });
});
