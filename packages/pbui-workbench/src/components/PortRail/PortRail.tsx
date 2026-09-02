import { badgeOf, planFollow, registerPort, startPortCarry, usePortCarry, type PortDefinition } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import type { ReactNode } from "react";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";
import { portRefOf, type PortRef } from "../../links/portRef";
import styles from "./PortRail.module.css";

export interface PortRailProps {
  view: AppView;
  /** Wrap one port's node in the product's `<port>` presentation; default: the plain node. */
  renderPort?(port: PortRef, node: ReactNode): ReactNode;
}

/**
 * The BACK SIDE of a tile in connect-management mode (design §6.8.3): an
 * overlay above the inert application listing the view's inputs on the left
 * edge and outputs on the right, each with its name, type, current state and
 * one-line doc. A pointerdown on an output starts the port carry; while one
 * is in flight, every input answers "may this land here?" through the same
 * planner the drop will use, so what lights up is what will work.
 */
export function PortRail({ view, renderPort }: PortRailProps) {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  const carry = usePortCarry();
  const ports = [...snapshot.ports.values()].filter((port) => port.viewId === view.id);
  const inputs = ports.filter((port) => port.declaration.direction !== "out");
  const outputs = ports.filter((port) => port.declaration.direction !== "in");

  const begin = (port: PortDefinition, event: React.PointerEvent) => {
    // A secondary button opens the menu instead; jsdom's synthetic events carry no button at all.
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startPortCarry({
      from: port.id,
      origin: { x: event.clientX ?? 0, y: event.clientY ?? 0 },
      acceptable: (target) => planFollow(port.id, target, workbench.links.snapshot(), workbench.links.deps).kind === "available",
      onDrop: (target, { shift }) => {
        // The modifier is read at RELEASE: Shift then means "and hold it there".
        if (!workbench.perform({ kind: "port.follow", source: port.id, destination: target })) return;
        if (shift) workbench.perform({ kind: "port.pin", port: target });
      },
      onCancel: () => undefined,
    });
  };

  const one = (port: PortDefinition, side: "in" | "out") => {
    const badge = badgeOf(port, snapshot, workbench.links.deps);
    const ref = portRefOf(badge, snapshot);
    const state = badge.state === "none" ? "unbound" : badge.state;
    const targeted = carry && carry.over === port.id;
    const acceptable = carry && side === "in" && carry.from !== port.id ? planFollow(carry.from, port.id, snapshot, workbench.links.deps).kind === "available" : false;
    const node = (
      <div
        key={`${side}:${port.id}`}
        ref={(element) => registerPort(port.id, element)}
        data-part="port-rail-port"
        data-port-id={port.id}
        data-side={side}
        data-direction={port.declaration.direction}
        data-state={state}
        data-acceptable={carry && side === "in" ? String(acceptable) : undefined}
        data-over={targeted || undefined}
        data-carrying={carry?.from === port.id || undefined}
        className={styles.port}
        title={`${port.declaration.doc}${badge.explanation ? ` — ${badge.explanation}` : ""}`}
        onPointerDown={side === "out" ? (event) => begin(port, event) : undefined}
      >
        <span className={styles.jack} aria-hidden="true">
          {side === "in" ? "◂" : "▸"}
        </span>
        <span className={styles.name}>{port.declaration.name}</span>
        <span className={styles.type}>&lt;{port.declaration.contract.valueType}&gt;</span>
        {badge.state !== "none" ? (
          <span className={styles.state} data-state={badge.state}>
            {badge.glyph} {badge.text}
          </span>
        ) : null}
        <span className={styles.doc}>{port.declaration.doc}</span>
      </div>
    );
    return renderPort && ref ? <span key={`${side}:${port.id}`}>{renderPort(ref, node)}</span> : node;
  };

  return (
    <div data-part="port-rail" className={styles.rail} data-view-id={view.id}>
      <div className={styles.column} data-side="in">
        {inputs.length > 0 ? inputs.map((port) => one(port, "in")) : <div className={styles.none}>no inputs</div>}
      </div>
      <div className={styles.column} data-side="out">
        {outputs.length > 0 ? outputs.map((port) => one(port, "out")) : <div className={styles.none}>no outputs</div>}
      </div>
    </div>
  );
}
