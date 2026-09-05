() => {
 const all=(s,r=document)=>[...r.querySelectorAll(s)];
 const root=document.querySelector('[data-part="workbench"]');
 if(!root)return {error:"no root"};
 const origin=root.getBoundingClientRect();
 const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x-origin.x,y:b.y-origin.y,width:b.width,height:b.height}};
 const tiles=all('[data-part="workbench-tile"] > [data-part="tile"]',root).map(e=>({title:e.querySelector('[data-part="tile-title"]')?.textContent?.trim(),...rect(e)}));
 const jacks=all('[data-part="port-jack"]',root).map(e=>{const b=rect(e),rail=e.closest('[data-part="port-rail"]'),r=rect(rail);return {id:e.dataset.portId,side:e.dataset.side,...b,clipped:b.y+b.height/2<r.y||b.y+b.height/2>r.y+r.height}});
 const wires=all('[data-part="wire"]',root).map(e=>{
 const path=e.querySelector('path'),d=path?.getAttribute('d')??"";
 let points=[];let x=0,y=0;const tokens=d.match(/[MLHV]|-?\d+(?:\.\d+)?/g)||[];
 for(let i=0;i<tokens.length;){const cmd=tokens[i++];if(cmd==="M"||cmd==="L"){x=+tokens[i++];y=+tokens[i++]}else if(cmd==="H")x=+tokens[i++];else if(cmd==="V")y=+tokens[i++];else break;points.push({x,y});}
 const from=jacks.find(j=>j.id===e.dataset.source&&j.side==="out"),to=jacks.find(j=>j.id===e.dataset.destination&&j.side==="in");
 const error=(p,j,side)=>p&&j?Math.hypot(p.x-(j.x+(side==="out"?j.width:0)),p.y-j.y-j.height/2):null;
 const diagonals=points.slice(1).flatMap((p,i)=>Math.abs(p.x-points[i].x)>.01&&Math.abs(p.y-points[i].y)>.01?[{a:points[i],b:p}]:[]);
 const intersections=[];
 if(path){const length=path.getTotalLength();for(const t of tiles){let count=0;for(let s=0;s<=length;s+=2){const p=path.getPointAtLength(s);if(p.x>t.x+2&&p.x<t.x+t.width-2&&p.y>t.y+2&&p.y<t.y+t.height-2)count++;}if(count)intersections.push({tile:t.title,samples:count});}}
 const label=e.querySelector('text'); let labelDistance=null;
 if(path&&label){const px=+label.getAttribute("x"),py=+label.getAttribute("y");labelDistance=Infinity;for(let s=0;s<=path.getTotalLength();s+=2){const p=path.getPointAtLength(s);labelDistance=Math.min(labelDistance,Math.hypot(p.x-px,p.y-py));}}
 return {term:e.dataset.term,source:e.dataset.source,destination:e.dataset.destination,d,points,diagonals,fromError:error(points[0],from,"out"),toError:error(points.at(-1),to,"in"),sourceClipped:from?.clipped,destinationClipped:to?.clipped,intersections,label:label?.textContent,labelDistance};
 });
 return {viewport:{width:innerWidth,height:innerHeight},surface:{x:origin.x,y:origin.y,width:origin.width,height:origin.height},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},tiles,jacks,wires,columns:all('[data-part="port-rail-column"]').map(e=>({side:e.dataset.side,view:e.closest('[data-view-id]')?.dataset.viewId,scrollTop:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})),cursor:document.querySelector('[data-part="wire-cursor"]')?.textContent};
}
