import { useId } from "react";
import { PHASES, type Phase } from "../phases";

/**
 * The four glyphs: arrow down, brain, eye, arrow up.
 *
 * Inline SVG rather than an icon font, for three reasons that all bite at once:
 * a font is a download the offline bundle cannot make, a glyph in a `<span>`
 * has no accessible name, and the fallback while it loads is a visible wrong
 * character.
 *
 * All four are solid, all four use `currentColor`, and all four sit on the same
 * 24x24 box so they line up under equal-width bars. The eye is the one that had
 * to be drawn twice: a plain lens-and-circle reads as a generic "view" icon at
 * any size, and the octagonal pupil inside a hexagonal lens is what makes it
 * read as *this* icon set.
 *
 * EXPORT is IMPORT rotated, not redrawn — one path, one transform, and they
 * therefore cannot drift apart.
 */

const ARROW = "M9.6,2 h4.8 v10.4 h4.4 L12,21.4 L5.2,12.4 h4.4 Z";

/**
 * Two lobes and a seam.
 *
 * The only organic shape in the set, and deliberately chunky: at 14px — the
 * size the sign-up tile uses — anything finer collapses into a smudge. Drawn as
 * one half and mirrored, so the two lobes are symmetric by construction.
 */
const BRAIN_HALF =
  "M11.1,2.6 C8.2,2.6 6.0,4.2 5.4,6.4 C3.6,7.0 2.4,8.6 2.4,10.5 " +
  "C2.4,11.6 2.8,12.6 3.5,13.4 C2.8,14.2 2.4,15.2 2.4,16.3 " +
  "C2.4,18.9 4.5,21.0 7.1,21.0 C8.0,21.0 8.9,20.7 9.6,20.2 " +
  "C10.0,20.9 10.5,21.4 11.1,21.4 Z";

/** Three gyri per lobe: the strokes that stop it reading as a bean. */
const BRAIN_GYRI = ["M5.4,6.4 H8.4", "M3.5,13.4 H9.0", "M5.2,18.4 H8.6"];

const EYE_LENS = "M1.2,12 L6.2,6.2 H17.8 L22.8,12 L17.8,17.8 H6.2 Z";
const EYE_PUPIL = "M12,8.2 L14.7,9.3 L15.8,12 L14.7,14.7 L12,15.8 L9.3,14.7 L8.2,12 L9.3,9.3 Z";

export interface PhaseIconProps {
  phase: Phase;
  /** In px. 24 is the drawn size; 14 is what the sign-up tile uses. */
  size?: number;
  /**
   * The accessible name, or omitted for a decorative icon.
   *
   * Omitted is the common case and the correct default: these almost always sit
   * beside the phase word, and an icon that repeats its own label is noise in a
   * screen reader rather than help.
   */
  title?: string;
  className?: string;
}

export function PhaseIcon({ phase, size = 24, title, className }: PhaseIconProps) {
  // Unique per instance, because an SVG <mask> lives in a document-wide id
  // namespace: two eyes on one page with a hard-coded id means the second
  // silently reuses the first's mask. `useId` is React's answer to exactly this
  // and is SSR-safe, unlike a module counter.
  const maskId = `${useId()}-pupil`;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      fill="currentColor"
    >
      {phase === "import" && <path d={ARROW} />}
      {phase === "export" && <path d={ARROW} transform="rotate(180 12 12)" />}
      {phase === "understand" && (
        <>
          <path d={BRAIN_HALF} />
          <path d={BRAIN_HALF} transform="translate(24 0) scale(-1 1)" />
          <g stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" fill="none">
            {BRAIN_GYRI.map((d) => (
              <path key={d} d={d} />
            ))}
            {BRAIN_GYRI.map((d) => (
              <path key={`m${d}`} d={d} transform="translate(24 0) scale(-1 1)" />
            ))}
          </g>
        </>
      )}
      {phase === "visualize" && (
        <>
          {/*
            The pupil is PUNCHED OUT, not drawn over.

            It used to be a second path filled with `--brand-paper`, which is
            correct on paper and wrong everywhere else: on the ink band, on the
            dark masthead, on any coloured surface, the pupil stays white and the
            eye reads as a sticker rather than as part of the page.

            A mask makes the hole a hole. `white` and `black` here are mask
            luminance — keep, discard — and have nothing to do with the icon's
            colour, which is still `currentColor` on the lens alone.
          */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <path d={EYE_LENS} fill="white" />
            <path d={EYE_PUPIL} fill="black" />
          </mask>
          <rect x="0" y="0" width="24" height="24" mask={`url(#${maskId})`} />
        </>
      )}
    </svg>
  );
}

/** Re-exported so a caller can render the whole set without a second import. */
export { PHASES };
