import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from "react";
import type { AnchorKey } from "./model";
import type { GeometryStore } from "./geometryStore";

export const GeometryContext = createContext<GeometryStore | null>(null);
export const useGeometryStore = () => useContext(GeometryContext);
export function useWiringGeometry(store: GeometryStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
export function useAnchorRegistration(key: AnchorKey) {
  const store = useGeometryStore();
  const dispose = useRef<(() => void) | null>(null);
  return useCallback((element: HTMLElement | null) => {
    dispose.current?.();
    dispose.current = element && store ? store.registerAnchor(key, element) : null;
  }, [store, key.placementId, key.portId, key.side]);
}
export function useFrameRegistration(placementId: string) {
  const store = useGeometryStore();
  const dispose = useRef<(() => void) | null>(null);
  return useCallback((element: HTMLElement | null) => {
    dispose.current?.();
    dispose.current = element && store ? store.registerFrame(placementId, element) : null;
  }, [store, placementId]);
}
