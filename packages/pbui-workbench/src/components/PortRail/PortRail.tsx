import { Button } from "@hyperslop-systems/pbui";
import { badgeOf, type PortDefinition } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { type ReactNode } from "react";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";
import { portRefOf } from "../../links/portRef";
import { useAnchorRegistration } from "../../wiring/geometryContext";
import { useConnectionController } from "../../wiring/connectionController";
import styles from "./PortRail.module.css";

export interface PortRailProps {
  view: AppView;
  placementId: string;

}

/** Measured port buttons share the surface connection controller. Product details
 * occupy a separate slot and cannot replace the required connection control. */
export function PortRail({ view, placementId }: PortRailProps) {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  const controller = useConnectionController();
  const ports = [...snapshot.ports.values()].filter((port) => port.viewId === view.id);
  const inputs = ports.filter((port) => port.declaration.direction !== "out");
  const outputs = ports.filter((port) => port.declaration.direction !== "in");

  const one = (port: PortDefinition, side: "in" | "out") => {
    const badge = badgeOf(port, snapshot, workbench.links.deps);
    const ref = portRefOf(badge, snapshot);
    const state = badge.state === "none" ? "unbound" : badge.state;
    const result = controller.source && side === "in" ? controller.preview(port.id) : null;
    const acceptable = result?.ok ?? false;
    const node = (
      <Button
        type="button"
        key={`${side}:${port.id}`}
        data-part="port-rail-port"
        data-port-id={port.id}
        data-side={side}
        data-direction={port.declaration.direction}
        data-state={state}
        data-acceptable={controller.source && side === "in" ? String(acceptable) : undefined}
        data-carrying={controller.source === port.id || undefined}
        className={styles.port}
        title={`${port.declaration.doc}${badge.explanation ? ` — ${badge.explanation}` : ""}`}
        onPointerDown={side === "out" ? (event) => controller.begin(port.id, event) : undefined}
        onClick={() => controller.choose(port.id, side)}
        aria-label={`${side === "out" ? "Choose source" : "Connect to"}: ${port.tileTitle} · ${port.declaration.name}`}
      >
        <span className={styles.name}>{port.declaration.name}</span>
        <span className={styles.type}>&lt;{port.declaration.contract.valueType}&gt;</span>
        {badge.state !== "none" ? (
          <span className={styles.state} data-state={badge.state}>
            {badge.glyph} {badge.text}
          </span>
        ) : null}
        <span className={styles.doc}>{port.declaration.doc}</span>
      </Button>
    );
    return <RegisteredCard key={`${side}:${port.id}`} placementId={placementId} portId={port.id} side={side}>{node}{ref ? controller.options.renderPortDetails?.(ref) : null}</RegisteredCard>;
  };

  return (
    <div data-part="port-rail" className={styles.rail} data-view-id={view.id}>
      <div className={styles.column} data-part="port-rail-column" data-side="in">
        {inputs.length > 0 ? inputs.map((port) => one(port, "in")) : <div className={styles.none}>no inputs</div>}
      </div>
      <div className={styles.column} data-part="port-rail-column" data-side="out">
        {outputs.length > 0 ? outputs.map((port) => one(port, "out")) : <div className={styles.none}>no outputs</div>}
      </div>
    </div>
  );
}

function RegisteredCard({ placementId, portId, side, children }: { placementId: string; portId: string; side: "in" | "out"; children: ReactNode }) {
  const ref = useAnchorRegistration({ placementId, portId, side });
  return <div ref={ref} className={styles.slot}>{children}</div>;
}
