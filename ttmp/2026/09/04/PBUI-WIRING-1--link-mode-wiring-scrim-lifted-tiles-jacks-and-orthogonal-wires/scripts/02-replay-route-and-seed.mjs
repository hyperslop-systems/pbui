// Run from any directory with Node 24. No production mutations.
// Replays captured browser rectangles through the current source router,
// then demonstrates the lab's refused seeding commands using built core.
import fs from "node:fs";
import { routeAround, Lanes } from "../../../../../../packages/pbui-workbench/src/components/WireLayer/route.ts";
import { createWorkbenchCore, createWorkbenchLinks, defineAppManifest, layout, split, tile } from "../../../../../../packages/workbench-core/dist/index.js";
const metrics = JSON.parse(fs.readFileSync(new URL("../design-doc/review-assets/resize-metrics.json", import.meta.url)));
const routing = metrics.map(m => {
 const lanes = new Lanes();
 return { viewport:m.viewport, wires:m.wires.map(w=>{
 const from=w.points[0],to=w.points.at(-1);
 const obstacles=m.tiles.map(t=>({left:t.x,top:t.y,right:t.x+t.width,bottom:t.y+t.height}));
 const points=routeAround(from,to,obstacles,lanes,{bounds:{left:-18,top:-18,right:m.surface.width+18,bottom:m.surface.height+18}});
 return {destination:w.destination.split("/").at(-1),points,diagonal:points?.slice(1).some((p,i)=>p.x!==points[i].x&&p.y!==points[i].y)};
 })};
});
const apps=[
 defineAppManifest({id:"source",ports:[{name:"count",direction:"out",contract:"number",doc:"count"},{name:"label",direction:"out",contract:"text",doc:"label"}]}),
 defineAppManifest({id:"sink",ports:[{name:"value",direction:"in",contract:"number",doc:"value"},{name:"anything",direction:"in",contract:"any",doc:"anything"}]})
];
const links=createWorkbenchLinks();
const core=createWorkbenchCore({apps,links,ownership:"freeze",initial:layout(split("row",.33,tile("source"),split("row",.5,tile("sink"),tile("sink"))))});
const [source,a,c]=core.getState().document.viewOrder;
const seed=[
 core.execute({kind:"port.follow",source:source+"/count",destination:a+"/value"}),
 core.execute({kind:"port.follow",source:source+"/label",destination:c+"/anything"}),
 core.execute({kind:"port.pin",port:c+"/anything"}),
 core.execute({kind:"identity.add",left:a+"/value",right:c+"/value",mergePolicy:"prefer-left"})
];
console.log(JSON.stringify({routing,seed},null,2));

