export interface Point { readonly x: number; readonly y: number }
export interface Rect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type Side = "in" | "out";
export interface AnchorKey { readonly placementId: string; readonly portId: string; readonly side: Side }
export const anchorId = (key: AnchorKey): string => JSON.stringify([key.placementId, key.portId, key.side]);
export interface AnchorGeometry {
  readonly id: string;
  readonly key: AnchorKey;
  readonly point: Point;
  readonly card: Rect;
  readonly clip: Rect;
  readonly visible: boolean;
}
export interface WiringGeometry {
  readonly epoch: number;
  readonly revision: number;
  readonly pending: boolean;
  readonly bounds: Rect;
  readonly frames: ReadonlyMap<string, Rect>;
  readonly anchors: readonly AnchorGeometry[];
}
export const emptyBounds: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
export const intersection = (a: Rect, b: Rect): Rect => ({ left: Math.max(a.left,b.left), top: Math.max(a.top,b.top), right: Math.min(a.right,b.right), bottom: Math.min(a.bottom,b.bottom) });
export const hasArea = (r: Rect): boolean => r.right > r.left && r.bottom > r.top;
