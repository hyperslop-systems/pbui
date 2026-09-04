import { badgeOf, planFollow, planIdentityAdd, registerPort, startPortCarry, usePortCarry, type PortDefinition } from "@hyperslop-systems/pbui";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
      // Ctrl (the toy's Alias modifier) asks for a SHARED cell instead of a follow; read live like Shift.
      acceptable: (target, { ctrl }) =>
        ctrl
          ? planIdentityAdd(port.id, target, "prefer-left", workbench.linkSnapshot(), workbench.links.deps).kind === "available"
          : planFollow(port.id, target, workbench.linkSnapshot(), workbench.links.deps).kind === "available",
      onDrop: (target, { shift, ctrl }) => {
        // The modifiers are read at RELEASE: Ctrl makes an identity, Shift means "and hold it there".
        if (ctrl) {
          workbench.execute({ kind: "identity.add", left: port.id, right: target, mergePolicy: "prefer-left" });
          return;
        }
        if (!workbench.execute({ kind: "port.follow", source: port.id, destination: target }).ok) return;
        if (shift) workbench.execute({ kind: "port.pin", port: target });
      },
      onCancel: () => undefined,
    });
  };

  const one = (port: PortDefinition, side: "in" | "out") => {
    const badge = badgeOf(port, snapshot, workbench.links.deps);
    const ref = portRefOf(badge, snapshot);
    const state = badge.state === "none" ? "unbound" : badge.state;
    const targeted = carry && carry.over === port.id;
    const acceptable =
      carry && side === "in" && carry.from !== port.id
        ? (carry.ctrl ? planIdentityAdd(carry.from, port.id, "prefer-left", snapshot, workbench.links.deps) : planFollow(carry.from, port.id, snapshot, workbench.links.deps)).kind === "available"
        : false;
    const node = (
      <div
        key={`${side}:${port.id}`}
        ref={(element) => registerPort(port.id, side, element)}
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
    return renderPort && ref ? (
      <div key={`${side}:${port.id}`} className={styles.slot}>
        {renderPort(ref, node)}
      </div>
    ) : node;
  };

  const railRef = useRef<HTMLDivElement>(null);
  const [jacks, setJacks] = useState<Array<{ id: string; side: "in" | "out"; top: number; bound: boolean }>>([]);
  const boundOf = (id: string) => {
    const port = snapshot.ports.get(id);
    if (!port) return false;
    const state = badgeOf(port, snapshot, workbench.links.deps).state;
    return state !== "none" && state !== "empty" && state !== "ambient";
  };

  /*
   * The jacks live in their own layer over the rail (PBUI-WIRING-1 P9): the
   * columns scroll when a tile has more ports than height, and a jack inside
   * a scrolling column would be clipped where it matters, on the frame. So
   * the cards are measured and each jack is placed at its card's centre line;
   * the layer clips top and bottom with the rail, never sideways.
   */
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => {
      const origin = rail.getBoundingClientRect();
      const next: Array<{ id: string; side: "in" | "out"; top: number; bound: boolean }> = [];
      for (const card of rail.querySelectorAll<HTMLElement>('[data-part="port-rail-port"]')) {
        const box = card.getBoundingClientRect();
        const id = card.dataset["portId"];
        const side = card.dataset["side"] as "in" | "out" | undefined;
        if (!id || !side) continue;
        next.push({ id, side, top: box.top + box.height / 2 - origin.top, bound: boundOf(id) });
      }
      setJacks((current) => (current.length === next.length && current.every((j, i) => j.id === next[i]!.id && j.side === next[i]!.side && Math.abs(j.top - next[i]!.top) < 0.5 && j.bound === next[i]!.bound) ? current : next));
    };
    measure();
    const columns = [...rail.querySelectorAll<HTMLElement>('[data-part="port-rail-column"]')];
    for (const column of columns) column.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(rail);
    window.addEventListener("resize", measure);
    return () => {
      for (const column of columns) column.removeEventListener("scroll", measure);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ports.length, snapshot]);

  // After the jacks are committed, tell the wire layer: a wire measured in the
  // same batch as a jack move would read where the jack was.
  useLayoutEffect(() => {
    railRef.current?.dispatchEvent(new CustomEvent("pbui:jacks-placed", { bubbles: true }));
  }, [jacks]);

  return (
    <div ref={railRef} data-part="port-rail" className={styles.rail} data-view-id={view.id}>
      <div className={styles.column} data-part="port-rail-column" data-side="in">
        {inputs.length > 0 ? inputs.map((port) => one(port, "in")) : <div className={styles.none}>no inputs</div>}
      </div>
      <div className={styles.column} data-part="port-rail-column" data-side="out">
        {outputs.length > 0 ? outputs.map((port) => one(port, "out")) : <div className={styles.none}>no outputs</div>}
      </div>
      <div className={styles.jacks} aria-hidden="true">
        {jacks.map((jack) => (
          <span key={`${jack.side}:${jack.id}`} data-part="port-jack" data-side={jack.side} data-port-id={jack.id} data-bound={jack.bound ? "" : undefined} className={styles.jack} style={{ top: jack.top }} />
        ))}
      </div>
    </div>
  );
}
