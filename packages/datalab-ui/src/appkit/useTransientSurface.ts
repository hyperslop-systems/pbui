export { useAnyEscapeSurface, useEscapeSurface } from "@hyperslop-systems/pbui";

/**
 * Escape ownership lives in the generic package now.
 *
 * DATALAB-VIEW-001 first put the stack in the layout slice, beside the other
 * transient fields, on the reasoning that transient interaction state belongs
 * in the store (DR-69). That reasoning is right about *this workbench's* state
 * and wrong about this particular fact, for one reason: **Escape is delivered
 * to the document, and "topmost" is a property of the page, not of a store.**
 *
 * A landing page holds six workbench instances, each with its own store. With
 * the stack per instance, a dialog open in one and an expanded panel in another
 * each believed itself topmost, and one key press closed both. The generic
 * package owns three of the handlers — `Dialog`, `ObjectMenu` and the accept
 * protocol — so it is also the only layer that can see far enough to order
 * them.
 *
 * This file is a re-export rather than a deletion so the two call sites here
 * keep a name that says what they are for, and so this note has somewhere to
 * live. See `@hyperslop-systems/pbui`'s `surfaces.ts` for the mechanism.
 */
