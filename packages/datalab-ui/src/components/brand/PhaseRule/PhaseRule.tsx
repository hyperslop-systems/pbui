import { PhaseIcon } from "../PhaseIcon";
import { PHASES, phaseVar } from "../phases";
import styles from "./PhaseRule.module.css";

/**
 * The four-bar rule: the brand's whole argument in eight pixels.
 *
 * Four equal bars, in order, in the phase colours — which are aliases of the
 * presentation tones (DR-98), so this rule and the 4px tone edge on a chip are
 * the same four colours. That is the point of the component existing rather
 * than being four divs written inline wherever it is needed.
 *
 * `labels` adds IMPORT - UNDERSTAND - VISUALIZE - EXPORT beneath, and `icons`
 * adds the glyphs above the labels; the sheet's full treatment is both. The
 * masthead uses neither and is just the bars, because at that size the words
 * would be four illegible smudges competing with the wordmark above them.
 *
 * ## On paper the labels are NOT set in their phase colour
 *
 * The tones are *graphic* colours held to 3:1 (`tokens.css:78-84`).
 * `--pbui-tone-step` as 11px text on paper is well under the 4.5:1 that text
 * requires, so on paper the words take `--brand-faint` and the colour is
 * carried by the bar and the icon beside them.
 *
 * `on="ink"` reverses that, and only that: against `--pbui-ink` the same tones
 * are light-on-dark and clear the threshold comfortably, which is why the brand
 * sheet's own usage example can print the four words in colour. The prop exists
 * so the choice is made by the surface rather than by whoever is looking at the
 * screenshot — setting them in colour on paper looks better and fails an audit,
 * and that is exactly the mistake a boolean `colour` prop would invite.
 *
 * ## `size` is a prop because it used to be the lockup's business
 *
 * The masthead's bars are 4px and the footer's are 3px — an 8px bar under a
 * 15px wordmark reads as a highlighter stripe rather than as a rule. Those two
 * heights were written in the lockup's half of a shared stylesheet, as
 * `.lockup_masthead .bar`, which made this component's appearance depend on who
 * was rendering it: the same `<PhaseRule />` drew differently inside a lockup
 * than in its own story, and neither the component nor its story said so.
 *
 * As a prop the size travels as data, the rule looks the same everywhere, and
 * the stories below can show all three.
 */
export type PhaseRuleSize = "hero" | "masthead" | "footer";

export interface PhaseRuleProps {
  /** IMPORT - UNDERSTAND - VISUALIZE - EXPORT beneath the bars. */
  labels?: boolean;
  /** The four glyphs between the bars and the labels. */
  icons?: boolean;
  /** Which surface this sits on. Decides whether the labels may take colour. */
  on?: "paper" | "ink";
  /** Bar thickness and the gap beneath. `hero` is the full-size rule. */
  size?: PhaseRuleSize;
  className?: string;
}

export function PhaseRule({
  labels = false,
  icons = false,
  on = "paper",
  size = "hero",
  className,
}: PhaseRuleProps) {
  return (
    <div
      className={[styles.rule, styles[`rule_${size}`], className ?? ""].filter(Boolean).join(" ")}
    >
      <div className={styles.bars} aria-hidden="true">
        {PHASES.map((phase) => (
          <span key={phase} className={styles.bar} style={{ background: phaseVar(phase) }} />
        ))}
      </div>

      {(icons || labels) && (
        <div className={styles.phases}>
          {PHASES.map((phase) => (
            <div key={phase} className={styles.phase}>
              {icons && (
                <span className={styles.phaseIcon} style={{ color: phaseVar(phase) }}>
                  <PhaseIcon phase={phase} size={28} />
                </span>
              )}
              {labels && (
                <span
                  className={styles.phaseLabel}
                  style={on === "ink" ? { color: phaseVar(phase) } : undefined}
                >
                  {phase}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
