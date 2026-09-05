import type { Point, Rect, Side } from "../model";
import { equal, inflate, inside, intersects, length, simplify, validPath, within } from "./validate";

export interface RouteOptions {
  clearance?: number;
  bend?: number;
  maxVertices?: number;
  maxStates?: number;
  fromSide?: Side;
  toSide?: Side;
  occupied?: readonly (readonly Point[])[];
  previous?: readonly Point[];
}
export type RouteResult =
  | { kind:"valid"; points:readonly Point[]; cost:number; vertices:number; expanded:number }
  | { kind:"unresolved"; reason:"blocked-attachment"|"no-path"|"budget-exceeded"|"invalid-final-geometry"; vertices:number; expanded:number };

/** A min heap keeps A* independent of browser and presentation concerns. */
class Queue {
  entries: Array<{state:number;cost:number;priority:number}>=[];
  push(value: {state:number;cost:number;priority:number}) {
    const a=this.entries; a.push(value); let i=a.length-1;
    while(i>0) { const p=(i-1)>>1; if(a[p]!.priority<=value.priority) break; a[i]=a[p]!; i=p; } a[i]=value;
  }
  pop() {
    const a=this.entries, first=a[0], last=a.pop();
    if(!first || !last || !a.length) return first;
    let i=0;
    while(i*2+1<a.length) {
      let child=i*2+1;
      if(child+1<a.length && a[child+1]!.priority<a[child]!.priority) child++;
      if(a[child]!.priority>=last.priority) break;
      a[i]=a[child]!; i=child;
    }
    a[i]=last; return first;
  }
}
const direction=(a:Point,b:Point)=>b.x>a.x?0:b.x<a.x?1:b.y>a.y?2:3;
const routeCost=(points:readonly Point[],bend:number)=>points.slice(1).reduce((sum,p,i)=>sum+length(points[i]!,p),0)+Math.max(0,points.length-2)*bend;
const coords=(values:readonly number[],lo:number,hi:number)=>{
  const base=[...new Set(values.filter(v=>Number.isFinite(v)&&v>=lo&&v<=hi))].sort((a,b)=>a-b);
  // Corridor center lines allow separated routes without rasterizing empty space.
  return [...new Set([...base,...base.slice(1).map((v,i)=>(base[i]!+v)/2)])].sort((a,b)=>a-b);
};

/** Orthogonal coordinate-line visibility graph, including Steiner intersections.
 * All graph edges and the final polyline are checked against expanded obstacles.
 */
export function routeOrthogonal(from: Point,to: Point,rectangles:readonly Rect[],bounds:Rect,options:RouteOptions={}):RouteResult {
  const obstacles=rectangles.map(r=>inflate(r,options.clearance??3.5));
  const bend=options.bend??24, fromSide=options.fromSide??"out", toSide=options.toSide??"in";
  const fail=(reason:Extract<RouteResult,{kind:"unresolved"}>["reason"],vertices=0,expanded=0):RouteResult=>({kind:"unresolved",reason,vertices,expanded});
  if(!within(from,bounds)||!within(to,bounds)||equal(from,to)||[from,to].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||obstacles.some(r=>inside(p,r)))) return fail("blocked-attachment");
  const xs=coords([bounds.left,bounds.right,from.x,to.x,from.x+(fromSide==="out"?6:-6),to.x+(toSide==="out"?6:-6),...obstacles.flatMap(r=>[r.left,r.right])],bounds.left,bounds.right);
  const ys=coords([bounds.top,bounds.bottom,from.y,to.y,...obstacles.flatMap(r=>[r.top,r.bottom])],bounds.top,bounds.bottom);
  const count=xs.length*ys.length;
  if(count>(options.maxVertices??60000)) return fail("budget-exceeded",count);
  const points:Point[]=[], blocked=new Uint8Array(count);
  for(let y=0;y<ys.length;y++) for(let x=0;x<xs.length;x++) {
    const p={x:xs[x]!,y:ys[y]!},index=y*xs.length+x;
    points.push(p); blocked[index]=Number(obstacles.some(r=>inside(p,r)));
  }
  const edges:Array<Array<{to:number;heading:number;cost:number}>>=Array.from({length:count},()=>[]);
  const occupancy=(a:Point,b:Point)=>{
    let penalty=0;
    for(const wire of options.occupied??[]) for(let i=1;i<wire.length;i++) {
      const c=wire[i-1]!,d=wire[i]!;
      if(a.y===b.y && c.y===d.y && a.y===c.y) penalty+=Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)))*0.6;
      if(a.x===b.x && c.x===d.x && a.x===c.x) penalty+=Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)))*0.6;
    }
    return penalty;
  };
  for(let i=0;i<count;i++) {
    if(blocked[i]) continue;
    for(const j of [i%xs.length+1<xs.length?i+1:-1,i+xs.length<count?i+xs.length:-1]) {
      if(j<0||blocked[j]) continue;
      const a=points[i]!,b=points[j]!;
      if(obstacles.some(r=>intersects(a,b,r))) continue;
      const cost=length(a,b)+occupancy(a,b);
      edges[i]!.push({to:j,heading:direction(a,b),cost}); edges[j]!.push({to:i,heading:direction(b,a),cost});
    }
  }
  const start=ys.indexOf(from.y)*xs.length+xs.indexOf(from.x), goal=ys.indexOf(to.y)*xs.length+xs.indexOf(to.x);
  const startHeading=fromSide==="out"?0:1, endHeading=toSide==="in"?0:1;
  const dist=new Float64Array(count*4).fill(Infinity),prev=new Int32Array(count*4).fill(-1),queue=new Queue();
  const startState=start*4+startHeading; dist[startState]=0;
  queue.push({state:startState,cost:0,priority:length(from,to)});
  let expanded=0,found=-1;
  while(queue.entries.length) {
    const item=queue.pop()!;
    if(item.cost!==dist[item.state]) continue;
    if(++expanded>(options.maxStates??160000)) return fail("budget-exceeded",count,expanded);
    const vertex=item.state>>2,heading=item.state&3;
    if(vertex===goal && heading===endHeading) {found=item.state;break;}
    for(const edge of edges[vertex]!) {
      if(item.state===startState && edge.heading!==startHeading) continue;
      if((heading^1)===edge.heading) continue;
      const state=edge.to*4+edge.heading,cost=item.cost+edge.cost+(heading===edge.heading?0:bend);
      if(cost>=dist[state]!) continue;
      dist[state]=cost;prev[state]=item.state;
      queue.push({state,cost,priority:cost+length(points[edge.to]!,to)});
    }
  }
  if(found<0) return fail("no-path",count,expanded);
  const path:Point[]=[];
  for(let state=found;state>=0;state=prev[state]!) path.push(points[state>>2]!);
  let final=simplify(path.reverse());
  if(!validPath(final,from,to,obstacles,bounds,fromSide,toSide)) return fail("invalid-final-geometry",count,expanded);
  const old=options.previous;
  if(old && old.length>=3) {
    const a=old[1]!,b=old.at(-2)!;
    const retained=simplify([from,{x:a.x,y:from.y},...old.slice(1,-1),{x:b.x,y:to.y},to]);
    if(validPath(retained,from,to,obstacles,bounds,fromSide,toSide) && routeCost(retained,bend)<=routeCost(final,bend)+24) final=retained;
  }
  return {kind:"valid",points:final,cost:routeCost(final,bend),vertices:count,expanded};
}
