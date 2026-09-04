import { portElement, portElements, useEscapeSurface, usePortCarry } from "@hyperslop-systems/pbui";
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

/*
 * An orthogonal route (PBUI-WIRING-1 P3): out of the source jack
 * horizontally, one vertical run, into the destination jack horizontally.
 * When the destination is to the left, the run detours: a short stub out,
 * a vertical run to the mid line between the two rows, back across, a stub
 * in. `channel` shifts the vertical run so parallel wires do not overlap.
 */
function route(a: Point, b: Point, channel = 0): string {
  const stub = 12;
  const gap = b.x - a.x;
  if (gap > 4) {
    // Forward: the vertical run sits in the gap (a 10px gutter between two
    // tiles is enough), the channel shifted within it.
    const half = gap / 2 - 2;
    const mx = Math.round((a.x + b.x) / 2 + Math.max(-half, Math.min(half, channel)));
    return `M ${a.x} ${a.y} H ${mx} V ${b.y} H ${b.x}`;
  }
  const my = Math.round((a.y + b.y) / 2 + channel);
  return `M ${a.x} ${a.y} H ${a.x + stub + Math.abs(channel)} V ${my} H ${b.x - stub - Math.abs(channel)} V ${b.y} H ${b.x}`;
}

/** Where a derived wire's label sits: on the vertical run. */
function labelPoint(a: Point, b: Point, channel = 0): Point {
  const stub = 12;
  if (b.x - a.x > 4) return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  return { x: a.x + stub + Math.abs(channel), y: Math.round((a.y + b.y) / 2 + channel) };
}

/* The wire meets the jack on the frame when the card has one, else the
 * card's edge (a product's own port markup). */
function anchorOf(element: HTMLElement, side: "in" | "out", root: HTMLElement): Point {
  const jack = element.querySelector<HTMLElement>(`[data-part="port-jack"][data-side="${side}"]`);
  const box = (jack ?? element).getBoundingClientRect();
  const origin = root.getBoundingClientRect();
  return { x: (side === "out" ? box.right : box.left) - origin.left, y: box.top + box.height / 2 - origin.top };
}

function anchor(id: string, side: "in" | "out", root: HTMLElement): Point | null {
  const element = portElement(id, side);
  return element ? anchorOf(element, side, root) : null;
}

/*
 * A view shown in two tiles has two elements per port. One wire per mounted
 * DESTINATION, from whichever mounted source is nearest to it: the reader
 * sees every place the link lands, and never a wire to a tile that is not
 * there (PBUI-WIRING-1 P1).
 */
function wireEnds(link: LinkRef, root: HTMLElement): Array<{ key: string; from: Point | null; to: Point | null }> {
  const sources = portElements(link.source, "out").map((element) => anchorOf(element, "out", root));
  const destinations = portElements(link.destination, "in").map((element) => anchorOf(element, "in", root));
  if (destinations.length === 0) return [{ key: link.linkId, from: sources[0] ?? null, to: null }];
  return destinations.map((to, index) => {
    let from: Point | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of sources) {
      const d = Math.hypot(candidate.x - to.x, candidate.y - to.y);
      if (d < best) {
        best = d;
        from = candidate;
      }
    }
    return { key: `${link.linkId}:${index}`, from, to };
  });
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
      workbench.dispatch({ kind: "link.mode.close" });
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
  const wires = root ? links.flatMap((link) => wireEnds(link, root).map((ends) => ({ link, ...ends }))) : [];
  // One channel per wire, centred on zero, six pixels apart.
  const channelOf = (index: number) => (index - (wires.length - 1) / 2) * 6;
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
        {wires.map(({ link, key, from, to }, index) => {
          const channel = channelOf(index);
          const path = from && to ? route(from, to, channel) : null;
          const at = from && to ? labelPoint(from, to, channel) : null;
          const node = (
            <g data-part="wire" data-link-id={link.linkId} data-term={link.kind} data-source={link.source} data-destination={link.destination} className={styles.wire}>
              {path ? (
                <>
                  <path d={path} className={styles.hit} data-part="wire-hit" />
                  <path d={path} className={styles.stroke} />
                  {link.kind === "identity" ? <path d={path} className={styles.inner} /> : null}
                  {link.kind === "derived" && at ? (
                    <text x={at.x + 6} y={at.y} className={styles.label} textAnchor="start">
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
          return <g key={key}>{renderWire ? renderWire(link, node) : node}</g>;
        })}
        {band?.from && band.to ? <path d={route(band.from, band.to)} className={styles.band} data-part="wire-band" data-acceptable={String(carry?.acceptable ?? false)} /> : null}
      </svg>
      {carry && band?.to && cursorLabel ? (
        <div className={styles.cursor} data-part="wire-cursor" data-acceptable={String(carry.acceptable)} style={{ left: band.to.x + 14, top: band.to.y + 14 }}>
          {cursorLabel}
        </div>
      ) : null}
    </div>
  );
}
