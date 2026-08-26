import { Meter, Text } from "@hyperslop-systems/pbui";
import { chat } from "../../chat";
import { METAL_IDS, METALS, metalReference } from "../../world";
import styles from "./MetalsApp.module.css";

/**
 * The spot board — a singleton, and the cheapest visible proof of what that
 * means.
 *
 * Place it twice from the launcher and the second attempt GOES TO the first;
 * split its tile and the two rectangles are a linked placement of one
 * `AppView`, in lockstep because the application is handed one object. Both
 * behaviours are invisible in a tile whose content varies per placement,
 * which is why the board draws a pure function of the world and nothing else:
 * there is nothing here that a second copy could show differently.
 *
 * Rows are `<metal>` presentations, so this board's `gold` and the agent's
 * `[[metal:gold|gold]]` are the same object with the same menu.
 */
export function MetalsApp() {
  return (
    <div data-part="metals-app" className={styles.app}>
      {METAL_IDS.map((id) => {
        const metal = METALS[id];
        return (
          <div key={id} className={styles.row}>
            <chat.pbui.Presentation reference={metalReference(id)} inComposite>
              <span className={styles.metal}>{metal.name}</span>
            </chat.pbui.Presentation>
            <Text size="small" className={styles.spot}>
              {metal.spotUsd.toFixed(2)}
            </Text>
            {/* The Go world carries `shareOfStockValue`, not a daily delta, so
                the bar is share of stock value. A ▲/▼ column here would be a
                number the resolver cannot back, and the chat would contradict
                the tile the first time anyone asked about it. */}
            <Meter
              fraction={metal.shareOfStockValue / 100}
              tone="var(--pbui-tone-metal)"
              accessibleName={`${metal.name} is ${metal.shareOfStockValue} percent of stock value`}
              value={`${metal.shareOfStockValue}%`}
            />
          </div>
        );
      })}
      <Text size="tiny" tone="faint">
        spot USD per oz · bar is share of stock value
      </Text>
    </div>
  );
}
