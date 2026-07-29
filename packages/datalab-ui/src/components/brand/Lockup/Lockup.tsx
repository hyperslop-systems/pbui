import { PhaseRule } from "../PhaseRule";
import { Wordmark, type WordmarkSize } from "../Wordmark";
import styles from "../Brand.module.css";

/**
 * Parent brand, wordmark, four-bar rule — the sheet's logo lockup.
 *
 * One component with three sizes rather than three components, because the
 * parts do not vary: what varies is how many of them are shown, and at what
 * scale. `hero` is everything; `masthead` is the wordmark over bare bars;
 * `footer` is the smallest legible version of the same.
 *
 * ## Where a lockup may appear
 *
 * The marketing masthead and hero, the workbench masthead, and the two auth
 * tiles. Nowhere else — a lockup inside an ordinary tile is a brand competing
 * with the interface it is supposed to be the frame for, and the workbench's
 * density is load-bearing (`tokens.css:9-14`).
 *
 * ## The accessible name lives in exactly one place
 *
 * When the parent line is shown it reads "A HYPERSLOP PRODUCT" and the wordmark
 * reads "DATA LAB"; announcing both is right. When it is not, the wordmark
 * carries the name alone. What must not happen is two elements both announcing
 * "DATA LAB", which is what an `aria-label` on the wrapper plus the SVG's own
 * would produce.
 */
export interface LockupProps {
  size?: WordmarkSize;
  /** "A HYPERSLOP PRODUCT" above the wordmark. */
  parent?: boolean;
  /** IMPORT - UNDERSTAND - VISUALIZE - EXPORT under the rule. */
  labels?: boolean;
  /** The four glyphs, between the rule and the labels. Hero only, in practice. */
  icons?: boolean;
  className?: string;
}

export function Lockup({
  size = "masthead",
  parent = false,
  labels = false,
  icons = false,
  className,
}: LockupProps) {
  return (
    <div
      className={[styles.lockup, styles[`lockup_${size}`], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {parent && <div className={styles.parent}>A Hyperslop product</div>}
      <Wordmark size={size} />
      <PhaseRule labels={labels} icons={icons} />
    </div>
  );
}

/**
 * DATA IN. INSIGHT OUT. — the sheet's usage example, reversed out of ink.
 *
 * Kept beside the lockup rather than in the marketing page because it is part
 * of the identity rather than part of the copy: the four phase words in their
 * own colours, on ink, is the one place the tones are legible as text, since
 * `--pbui-tone-*` against `--pbui-ink` is a different contrast question from
 * the same tones against paper.
 *
 * That is also the one caveat. These four ARE set in their phase colours, which
 * the labels under `PhaseRule` deliberately are not, and the difference is the
 * background: on ink the tones are light-on-dark and clear the threshold, on
 * paper they do not. If a light variant of this block is ever wanted, the words
 * must lose their colour.
 */
export function ClaimBlock({ className }: { className?: string }) {
  return (
    <div className={[styles.claim, className ?? ""].filter(Boolean).join(" ")}>
      <div className={styles.claimText}>
        Data in.
        <br />
        Insight out.
      </div>
      <PhaseRule labels on="ink" className={styles.claimRule} />
    </div>
  );
}
