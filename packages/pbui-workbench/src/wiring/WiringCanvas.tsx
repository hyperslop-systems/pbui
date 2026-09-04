import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWorkbench } from '../context';
import { useLinkSnapshot } from '../links/hooks';
import { linkRefsOf, type LinkRef } from '../links/linkRef';
import { useGeometryStore, useWiringGeometry } from './geometryContext';
import { buildScene, type WiringScene } from './scene';
import { pathData } from './routing/validate';
import { useConnectionController } from './connectionController';
import styles from '../components/WireLayer/WireLayer.module.css';

export function WiringCanvas() {
  const controller=useConnectionController();
  const store=useGeometryStore()!;
  const geometry=useWiringGeometry(store),wb=useWorkbench(),snapshot=useLinkSnapshot(wb);
  const previous=useRef<WiringScene|undefined>(undefined);
  const [metrics,setMetrics]=useState(new Map<string,{text:string;width:number;height:number}>());
  useLayoutEffect(()=>{
    const root=store.root(); if(!root) return;
    const measure=document.createElement('span');
    measure.style.cssText='position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;font-size:10px;font-weight:700;';
    root.append(measure);
    const next=new Map<string,{text:string;width:number;height:number}>();
    for(const r of wb.links.deps.relations??[]) { measure.textContent=r.label??r.id; const box=measure.getBoundingClientRect(); next.set(r.id,{text:measure.textContent,width:box.width,height:box.height}); }
    measure.remove(); setMetrics(next);
  },[store,wb]);
  const semantic=JSON.stringify(linkRefsOf(snapshot));
  const scene=useMemo(()=>buildScene(geometry,JSON.parse(semantic) as LinkRef[],metrics,previous.current),[geometry,semantic,metrics]);
  useLayoutEffect(()=>{if(!scene.pending) previous.current=scene;},[scene]);
  return <div data-part="workbench-wires" className={styles.layer} data-revision={scene.revision} data-pending={scene.pending||undefined}>
    <svg className={styles.svg} aria-label="Connections" onClick={event=>{
      const root=store.root(); if(!root) return;
      const rect=root.getBoundingClientRect(),x=event.clientX-rect.left-root.clientLeft,y=event.clientY-rect.top-root.clientTop;
      const candidates=scene.wires.flatMap(w=>{
        if(w.route.kind!=="valid") return [];
        let distance=Infinity;
        for(let i=1;i<w.route.points.length;i++) {
          const a=w.route.points[i-1]!,b=w.route.points[i]!;
          const px=Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),x));
          const py=Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),y));
          distance=Math.min(distance,Math.hypot(px-x,py-y));
        }
        return distance<=6?[{id:w.link.linkId,distance}]:[];
      }).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
      controller.setSelected([...new Set(candidates.map(c=>c.id))]);
    }}>
      {scene.wires.map(w=>{
        const path=w.route.kind==='valid'?pathData(w.route.points):null;
        const node=<g data-part="wire" data-link-id={w.link.linkId} data-term={w.link.kind} data-source={w.link.source} data-destination={w.link.destination} data-route={w.route.kind} className={styles.wire}>
          {path?<><path d={path} className={styles.hit} data-part="wire-hit"/><path d={path} className={styles.stroke}/>{w.link.kind==='identity'?<path d={path} className={styles.inner}/>:null}</>: [w.from,w.to].filter(Boolean).map((a,i)=><circle key={i} cx={a!.point.x} cy={a!.point.y} r={5} className={styles.portal}/>)}
          {w.label?<text x={w.label.point.x} y={w.label.point.y} textAnchor="middle" dominantBaseline="central" className={styles.label}>{w.label.text}</text>:null}
          <title>{`${w.link.sourceTitle} → ${w.link.destinationTitle} (${w.link.kind})${w.route.kind==='unresolved'?' — endpoint hidden or no safe route':''}`}</title>
        </g>;
        return <g key={w.id}>{node}</g>;
      })}
    </svg>
  </div>;
}
