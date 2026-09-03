import { portElement, useEscapeSurface, usePortCarry } from "@hyperslop-systems/pbui";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";
import { linkRefsOf, type LinkRef } from "../../links/linkRef";
import styles from "./WireLayer.module.css";

export interface WireLayerProps {
  /** Wrap one wire's `<g>` in the product's `<link>` presentation (with `svg`); default: a plain group with a title. */
  renderWire?(link: LinkRef, node: ReactNode): ReactNode;
}

interface Point {
  x: number;
  y: number;
}

/** The toy's cubic (core.js:256): horizontal tangents, so a wire leaves a jack sideways. */
function cubic(a: Point, b: Point): string {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

function anchor(id: string, side: "in" | "out", root: HTMLElement): Point | null {
  const element = portElement(id);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  return { x: (side === "out" ? box.right : box.left) - origin.left, y: box.top + box.height / 2 - origin.top };
}

/**
 * ONE SVG for the whole surface (design §6.8.3): a wire per declared term,
 * styled by kind — solid arrow for follow, labelled for derived, dotted for
 * the suspended source under a hold, broken for a wire whose end is off
 * screen — plus the rubber band and the cursor badge while a carry is in
 * flight. Geometry is read from the rails' DOM rectangles and is explanatory
 * only; nothing semantic depends on position. The layer owns Escape while
 * the mode is open: Escape closes the mode, and nothing else.
 */
export function WireLayer({ renderWire }: WireLayerProps) {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  const carry = usePortCarry();
  const [tick, setTick] = useState(0);
  const top = useEscapeSurface(true);

  useEffect(() => {
    if (!top) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || carry) return;
      event.preventDefault();
      workbench.perform({ kind: "link.mode.close" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, carry, workbench]);

  // Re-measure after layout settles, on resize, and when the surface's size changes.
  useLayoutEffect(() => {
    const root = workbench.root();
    const bump = () => setTick((n) => n + 1);
    const frame = requestAnimationFrame(bump);
    window.addEventListener("resize", bump);
    const observer = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(bump) : null;
    if (root && observer) observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", bump);
      observer?.disconnect();
    };
  }, [workbench, snapshot]);

  const root = workbench.root();
  const links = linkRefsOf(snapshot);
  const rootBox = root?.getBoundingClientRect();
  const wires = root
    ? links.map((link) => ({ link, from: anchor(link.source, "out", root), to: anchor(link.destination, "in", root) }))
    : [];
  const band = carry && root ? { from: anchor(carry.from, "out", root), to: rootBox ? { x: carry.x - rootBox.left, y: carry.y - rootBox.top } : null } : null;
  const sourceOfCarry = carry ? snapshot.ports.get(carry.from) : undefined;
  const overDefinition = carry?.over ? snapshot.ports.get(carry.over) : undefined;
  const term = carry ? (carry.ctrl ? "Share" : carry.shift ? "Hold" : "Follow") : "";
  const cursorLabel = carry
    ? carry.over && carry.acceptable && sourceOfCarry
      ? carry.ctrl
        ? `Share(${sourceOfCarry.tileTitle} · ${sourceOfCarry.declaration.name} ≡ ${overDefinition?.tileTitle ?? ""} · ${overDefinition?.declaration.name ?? ""})`
        : `${term}(${sourceOfCarry.tileTitle} · ${sourceOfCarry.declaration.name}${carry.shift ? ", then pin" : ""}) → ${overDefinition?.tileTitle ?? ""} · ${overDefinition?.declaration.name ?? ""}`
      : carry.over && overDefinition
        ? `cannot ${carry.ctrl ? "share with" : "land on"} ${overDefinition.tileTitle} · ${overDefinition.declaration.name}`
        : `${term}(${sourceOfCarry?.tileTitle ?? carry.from}) — drop on an input${carry.ctrl ? " to share one cell" : ""}`
    : null;

  return (
    <div data-part="workbench-wires" className={styles.layer} data-tick={tick} data-carrying={carry ? "" : undefined}>
      <svg className={styles.svg} aria-hidden="true">
        <defs>
          <marker id="pbui-wire-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {wires.map(({ link, from, to }) => {
          const path = from && to ? cubic(from, to) : null;
          const node = (
            <g data-part="wire" data-link-id={link.linkId} data-term={link.kind} data-source={link.source} data-destination={link.destination} className={styles.wire}>
              {path ? (
                <>
                  <path d={path} className={styles.hit} data-part="wire-hit" />
                  <path d={path} className={styles.stroke} {...(link.kind === "identity" ? {} : { markerEnd: "url(#pbui-wire-arrow)" })} />
                  {link.kind === "identity" ? <path d={path} className={styles.inner} /> : null}
                  {link.kind === "derived" && from && to ? (
                    <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} className={styles.label} textAnchor="middle">
                      {workbench.links.deps.relations?.find((r) => r.id === link.relationId)?.label ?? link.relationId}
                    </text>
                  ) : null}
                </>
              ) : from || to ? (
                // One end is off screen (another workspace, or a rail not mounted): a portal stub.
                <circle cx={(from ?? to)!.x} cy={(from ?? to)!.y} r={5} className={styles.portal} />
              ) : null}
              <title>{`${link.destinationTitle} ${link.kind === "held" ? "(held) ← " : "← "}${link.sourceTitle}`}</title>
            </g>
          );
          return <g key={link.linkId}>{renderWire ? renderWire(link, node) : node}</g>;
        })}
        {band?.from && band.to ? <path d={cubic(band.from, band.to)} className={styles.band} data-part="wire-band" data-acceptable={String(carry?.acceptable ?? false)} /> : null}
      </svg>
      {carry && band?.to && cursorLabel ? (
        <div className={styles.cursor} data-part="wire-cursor" data-acceptable={String(carry.acceptable)} style={{ left: band.to.x + 14, top: band.to.y + 14 }}>
          {cursorLabel}
        </div>
      ) : null}
    </div>
  );
}
