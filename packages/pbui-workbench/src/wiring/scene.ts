import type { LinkRef } from '../links/linkRef';
import type { AnchorGeometry, Point, WiringGeometry } from './model';
import { routeOrthogonal, type RouteResult } from './routing/route';
import { length } from './routing/validate';
export interface SceneWire {
  id:string; link:LinkRef; from?:AnchorGeometry; to?:AnchorGeometry;
  route:RouteResult; label?:{text:string;point:Point};
}
export interface WiringScene { revision:number; pending:boolean; wires:readonly SceneWire[] }

/** Pure projection. Missing or clipped endpoints never become fabricated routes. */
export function buildScene(geometry:WiringGeometry, links:readonly LinkRef[], labels:ReadonlyMap<string,{text:string;width:number;height:number}>, previous?:WiringScene):WiringScene {
  const wires:SceneWire[]=[], occupied:Array<readonly Point[]>=[];
  const old=new Map(previous?.wires.map(w=>[w.id,w]));
  const visible=(port:string,side:'in'|'out')=>geometry.anchors.filter(a=>a.key.portId===port&&a.key.side===side&&a.visible).sort((a,b)=>a.id.localeCompare(b.id));
  for(const link of [...links].sort((a,b)=>a.linkId.localeCompare(b.linkId))) {
    const sources=visible(link.source,'out'), destinations=visible(link.destination,'in');
    const pairs:Array<{id:string;from?:AnchorGeometry;to?:AnchorGeometry}>=destinations.map(to=>{
      const id=JSON.stringify([link.linkId,to.id]);
      const retained=sources.find(a=>a.id===old.get(id)?.from?.id);
      const from=retained??[...sources].sort((a,b)=>length(a.point,to.point)-length(b.point,to.point)||a.id.localeCompare(b.id))[0];
      return {id,...(from?{from}:{}),to};
    });
    if(!destinations.length) pairs.push({id:link.linkId,...(sources[0]?{from:sources[0]}:{})});
    if(link.kind==='identity') for(const from of sources) {
      if(pairs.some(p=>p.from?.id===from.id)) continue;
      const to=destinations[0];
      pairs.push({id:JSON.stringify([link.linkId,from.id]),from,...(to?{to}:{})});
    }
    for(const pair of pairs) {
      const prior=old.get(pair.id)?.route;
      const route=pair.from&&pair.to&&!geometry.pending?routeOrthogonal(pair.from.point,pair.to.point,[...geometry.frames.values()],geometry.bounds,{occupied,...(prior?.kind==='valid'?{previous:prior.points}:{})}):{kind:'unresolved' as const,reason:'blocked-attachment' as const,vertices:0,expanded:0};
      const wire:SceneWire={...pair,link,route};
      if(route.kind==='valid') {
        occupied.push(route.points);
        const metric=labels.get(link.relationId??'');
        if(metric) for(let i=1;i<route.points.length;i++) {
          const a=route.points[i-1]!,b=route.points[i]!;
          if(a.y!==b.y||Math.abs(a.x-b.x)<metric.width+12) continue;
          const point={x:(a.x+b.x)/2,y:a.y};
          const box={left:point.x-metric.width/2-3,right:point.x+metric.width/2+3,top:point.y-metric.height/2-2,bottom:point.y+metric.height/2+2};
          if(box.left<geometry.bounds.left||box.right>geometry.bounds.right||box.top<geometry.bounds.top||box.bottom>geometry.bounds.bottom) continue;
          if([...geometry.frames.values()].some(r=>box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top)) continue;
          wire.label={text:metric.text,point}; break;
        }
      }
      wires.push(wire);
    }
  }
  return {revision:geometry.revision,pending:geometry.pending,wires};
}
