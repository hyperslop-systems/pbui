import { expect, it } from 'vitest';
import { buildScene } from './scene';
import type { WiringGeometry, AnchorGeometry } from './model';
import type { LinkRef } from '../links/linkRef';
const anchor=(id:string,portId:string,side:'in'|'out',x:number):AnchorGeometry=>({id,key:{placementId:id,portId,side},point:{x,y:30},visible:true,card:{left:x,top:20,right:x+10,bottom:40},clip:{left:0,top:0,right:100,bottom:100}});
const geometry:WiringGeometry={epoch:1,revision:1,pending:false,bounds:{left:0,top:0,right:100,bottom:100},frames:new Map(),anchors:[anchor('a','source','out',10),anchor('b','dest','in',80)]};
const link:LinkRef={linkId:'ab',source:'source',destination:'dest',sourceTitle:'Source',destinationTitle:'Dest',kind:'follow'};
it('projects exact endpoints and reports missing/hidden endpoints without a fallback path',()=>{
  const scene=buildScene(geometry,[link],new Map());
  expect(scene.wires[0]?.route.kind).toBe('valid');
  const hidden=buildScene({...geometry,anchors:geometry.anchors.map(a=>({...a,visible:a.id==='a'}))},[link],new Map());
  expect(hidden.wires).toHaveLength(1);
  expect(hidden.wires[0]?.route.kind).toBe('unresolved');
  expect(hidden.wires[0]?.from?.id).toBe('a');
});
it('retains a mounted source occurrence and represents duplicate identity sources',()=>{
  const g={...geometry,anchors:[...geometry.anchors,anchor('c','source','out',60)]};
  const first=buildScene(geometry,[link],new Map());
  expect(buildScene(g,[link],new Map(),first).wires[0]?.from?.id).toBe('a');
  expect(buildScene(g,[{...link,kind:'identity'}],new Map()).wires).toHaveLength(2);
});
