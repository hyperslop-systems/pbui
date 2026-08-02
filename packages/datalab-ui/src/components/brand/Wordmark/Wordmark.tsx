import styles from "./Wordmark.module.css";

/**
 * DATA LAB, drawn rather than typeset.
 *
 * ## Why SVG and not a webfont (DATADROP-14 DR-92)
 *
 * `tokens.css` forbids downloading a font: the bundle is embedded in a Go
 * binary and served offline, so a webfont request either fails or reaches a
 * third party. Self-hosting a subset would answer the third-party half and
 * leaves two others — 20-60KB on the critical path, and a licence for
 * letterforms we need in exactly three sizes.
 *
 * The wordmark is not text that happens to be styled; it appears at three fixed
 * sizes and never as body copy. That makes it a **graphic**, and a graphic
 * should be an SVG: exact letterforms, no flash of unstyled text, no bytes
 * fetched, no licence question. Choosing the real display face is deferred, and
 * when it happens this file is replaced rather than edited.
 *
 * ## The letterforms
 *
 * Five distinct glyphs — D A T L B — on a 100x140 unit body with a 30-unit
 * stem, chamfered corners in place of curves. The chamfer is what makes it read
 * as the brand sheet's face rather than as a generic geometric sans: the D and
 * B have no round side at all, only a 22-unit diagonal cut.
 *
 * Each glyph is one path with `fill-rule: evenodd`, so counters (the hole in a
 * D, the two in a B) are subpaths of the same shape rather than separate
 * elements. That matters for the inverted variant: one path means one fill, so
 * `currentColor` is the only colour decision anywhere in this file.
 *
 * Advances are hand-set rather than uniform. `L` is 90 wide against everyone
 * else's 100 because its bottom-right is open, and a 100-unit L opens a hole
 * before the A that no tracking value fixes.
 */

/** One glyph: its path data and how far to advance after drawing it. */
interface Glyph {
  d: string;
  width: number;
}

const TRACK = 14;
const WORD_SPACE = 46;

/**
 * D — chamfered on the right, where a Roman D would be round.
 * Outer shape then counter, wound so evenodd punches the hole.
 */
const D: Glyph = {
  width: 100,
  d: "M0,0 H78 L100,22 V118 L78,140 H0 Z " + "M30,30 V110 H62 L70,102 V38 L62,30 Z",
};

/** A — chamfered apex, flat-bottomed legs, crossbar from the counter's base. */
const A: Glyph = {
  width: 100,
  d:
    "M0,140 V42 L36,0 H64 L100,42 V140 H70 V100 H30 V140 Z " + "M30,70 V52 L44,30 H56 L70,52 V70 Z",
};

/** T — chamfered top corners; the only glyph with no counter. */
const T: Glyph = {
  width: 100,
  d: "M14,0 H86 L100,14 V30 H65 V140 H35 V30 H0 V14 Z",
};

/** L — chamfered bottom-left, and 10 units narrower than the rest. */
const L: Glyph = {
  width: 90,
  d: "M0,0 H30 V110 H90 V140 H14 L0,126 Z",
};

/** B — two counters, chamfered right on both bowls. */
const B: Glyph = {
  width: 100,
  d:
    "M0,0 H74 L96,22 V52 L84,66 L100,80 V118 L78,140 H0 Z " +
    "M30,28 V56 H62 L68,50 V34 L62,28 Z " +
    "M30,84 V112 H64 L70,106 V90 L64,84 Z",
};

/** The lockup, left to right, with a word space between DATA and LAB. */
const LETTERS: readonly Glyph[] = [D, A, T, A, L, A, B];
const SPACE_AFTER = 3; // the index after which the word space falls

/** Laid out once at module load; the geometry never changes. */
const { placed, width: VIEW_WIDTH } = layout();
const VIEW_HEIGHT = 140;

function layout(): { placed: Array<{ glyph: Glyph; x: number }>; width: number } {
  const placed: Array<{ glyph: Glyph; x: number }> = [];
  let x = 0;
  LETTERS.forEach((glyph, index) => {
    placed.push({ glyph, x });
    x += glyph.width;
    if (index === LETTERS.length - 1) return;
    x += index === SPACE_AFTER ? WORD_SPACE : TRACK;
  });
  return { placed, width: x };
}

export type WordmarkSize = "hero" | "masthead" | "footer";

export interface WordmarkProps {
  size?: WordmarkSize;
  /**
   * The accessible name.
   *
   * Defaulted rather than optional-and-absent: this is TEXT rendered as a
   * graphic, so without a name a screen reader announces nothing at all where a
   * sighted reader sees the product's name. Pass `""` deliberately — and only —
   * when an adjacent element already says "DATA LAB", which is the case inside
   * `Lockup` when the parent brand line is shown.
   */
  title?: string;
  className?: string;
}

export function Wordmark({ size = "masthead", title = "DATA LAB", className }: WordmarkProps) {
  const decorative = title === "";
  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className={[styles.wordmark, styles[size], className ?? ""].filter(Boolean).join(" ")}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
    >
      {placed.map(({ glyph, x }, index) => (
        // The index is a legitimate key here: the array is a constant laid out
        // at module load, so nothing reorders and there is no id to use — the
        // three A's are the same glyph object.
        // eslint-disable-next-line react/no-array-index-key
        <path key={index} d={glyph.d} transform={`translate(${x} 0)`} fillRule="evenodd" />
      ))}
    </svg>
  );
}

/** The drawn width, in viewBox units. `PhaseRule` matches it. */
export const WORDMARK_ASPECT = VIEW_WIDTH / VIEW_HEIGHT;
