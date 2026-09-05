import { AppBody, EmptyState, JsonBlock, TileHeader } from "@hyperslop-systems/pbui";
import type { PresentationReference } from "@hyperslop-systems/pbui";
import { usePort, type AppProps } from "@hyperslop-systems/pbui-workbench";
import type { Shop } from "../../createShop";
import type { Values } from "../../presentation/types";
import styles from "../tiles.module.css";

export interface InspectorProps extends AppProps {
  shop: Shop;
}

/**
 * Anything inspectable, as data, read through the `subject` in port. The
 * port's contract is the abstract `inspectable` type, so an order, a
 * customer, a SKU, a mark, a category or a metal all reach it by graph
 * reachability alone.
 */
export function Inspector({ shop, view }: InspectorProps) {
  const { ObjectChip } = shop.pbui;
  const port = usePort(view, "subject");
  const subject = port.reference as PresentationReference<Values> | null;
  if (!subject) {
    return (
      <div data-part="inspector" className={styles.empty}>
        <EmptyState message="nothing inspected yet" hint={`${port.badge.explanation}. Right-click anything and choose “Link to inspector”.`} />
      </div>
    );
  }
  return (
    <div data-part="inspector" className={styles.app}>
      <TileHeader
        title={
          <ObjectChip reference={subject} doc={`the inspected <${subject.type}>`} inComposite>
            &lt;{subject.type}&gt;
          </ObjectChip>
        }
        status={port.badge.explanation}
      />
      <AppBody flush className={styles.body}>
        <div className={styles.detail}>
          <JsonBlock value={subject.value} />
        </div>
      </AppBody>
    </div>
  );
}
