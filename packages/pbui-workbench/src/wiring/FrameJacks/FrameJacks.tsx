import { Button } from "@hyperslop-systems/pbui";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";
import { useGeometryStore, useWiringGeometry } from ".././geometryContext";
import type { GeometryStore } from ".././geometryStore";
import { useConnectionController } from ".././connectionController";
import styles from "./FrameJacks.module.css";

export function FrameJacks({ placementId }: { placementId: string }) {
  const store = useGeometryStore();
  return store ? <MeasuredJacks store={store} placementId={placementId} /> : null;
}
function MeasuredJacks({ store, placementId }: { store: GeometryStore; placementId: string }) {
  const controller = useConnectionController();
  const geometry = useWiringGeometry(store);
  const snapshot = useLinkSnapshot(useWorkbench());
  const frame = geometry.frames.get(placementId);
  if (!frame) return null;
  return <>{geometry.anchors.filter(a => a.key.placementId === placementId && a.visible).map(anchor => (
    <Button type="button" tabIndex={-1} aria-label={`Jack ${anchor.key.portId}`} onClick={() => controller.choose(anchor.key.portId, anchor.key.side)} onPointerDown={anchor.key.side === "out" ? event => controller.begin(anchor.key.portId,event) : undefined} key={anchor.id} className={styles.jack} data-part="port-jack" data-port-id={anchor.key.portId} data-side={anchor.key.side}
      data-bound={snapshot.bindings.has(anchor.key.portId) || snapshot.aliases.has(anchor.key.portId) || undefined}
      style={{ left: anchor.point.x-(anchor.key.side === "out" ? 12 : 0)-frame.innerLeft, top: anchor.point.y-6-frame.innerTop }} />
  ))}</>;
}
