import type { Point, Rect, Side } from "../model";
export const inflate = (r: Rect, margin: number): Rect => ({ left:r.left-margin, top:r.top-margin, right:r.right+margin, bottom:r.bottom+margin });
export const inside = (p: Point, r: Rect) => p.x>r.left && p.x<r.right && p.y>r.top && p.y<r.bottom;
export const within = (p: Point, r: Rect) => p.x>=r.left && p.x<=r.right && p.y>=r.top && p.y<=r.bottom;
export const equal = (a: Point, b: Point) => a.x===b.x && a.y===b.y;
export function intersects(a: Point, b: Point, r: Rect): boolean {
  if(a.y===b.y) return a.y>r.top && a.y<r.bottom && Math.max(Math.min(a.x,b.x),r.left)<Math.min(Math.max(a.x,b.x),r.right);
  if(a.x===b.x) return a.x>r.left && a.x<r.right && Math.max(Math.min(a.y,b.y),r.top)<Math.min(Math.max(a.y,b.y),r.bottom);
  return true; // Diagonals are never accepted by the orthogonal geometry contract.
}
export function validPath(points: readonly Point[], from: Point, to: Point, obstacles: readonly Rect[], bounds: Rect, fromSide: Side="out", toSide: Side="in"): boolean {
  if(points.length<2 || !equal(points[0]!,from) || !equal(points.at(-1)!,to)) return false;
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!within(p,bounds))) return false;
  const first=points[1]!, last=points.at(-2)!;
  if(first.y!==from.y || (first.x-from.x)*(fromSide==="out"?1:-1)<=0) return false;
  if(last.y!==to.y || (last.x-to.x)*(toSide==="out"?1:-1)<=0) return false;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1]!,b=points[i]!;
    if(equal(a,b) || (a.x!==b.x && a.y!==b.y) || obstacles.some(r=>intersects(a,b,r))) return false;
  }
  return true;
}
export function simplify(points: readonly Point[]): Point[] {
  const out: Point[]=[];
  for(const point of points) {
    if(out.length && equal(out.at(-1)!,point)) continue;
    while(out.length>=2) {
      const a=out.at(-2)!,b=out.at(-1)!;
      const straight=(a.x===b.x && b.x===point.x && (b.y-a.y)*(point.y-b.y)>=0)||(a.y===b.y && b.y===point.y && (b.x-a.x)*(point.x-b.x)>=0);
      if(!straight) break;
      out.pop();
    }
    out.push(point);
  }
  return out;
}
export const pathData = (points: readonly Point[]) => points.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
export const length = (a: Point,b: Point) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
