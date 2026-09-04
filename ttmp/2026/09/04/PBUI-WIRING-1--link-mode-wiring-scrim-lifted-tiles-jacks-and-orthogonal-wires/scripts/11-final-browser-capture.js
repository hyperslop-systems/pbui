async page => {
  const base='/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/04/PBUI-WIRING-1--link-mode-wiring-scrim-lifted-tiles-jacks-and-orthogonal-wires/design-doc/review-assets/';
  const measurements=[];
  for(const width of [1920,1440,1024,768,390]) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(300);
    measurements.push(await page.evaluate(()=>{
      const root=document.querySelector('[data-workbench-shell]'),r=root.getBoundingClientRect();
      const relative=e=>{const b=e.getBoundingClientRect();return {left:b.left-r.left,top:b.top-r.top,right:b.right-r.left,bottom:b.bottom-r.top};};
      const rects=[...root.querySelectorAll('[data-part="tile"]')].map(relative);
      const endpointError=(point,port,side)=>Math.min(...[...root.querySelectorAll('[data-part="port-jack"]')].filter(e=>e.dataset.portId===port&&e.dataset.side===side).map(e=>{const b=relative(e);return Math.hypot(point.x-(side==='out'?b.right:b.left),point.y-(b.top+b.bottom)/2);}));
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,focused:root.hasAttribute('data-wiring-focused'),projectionMs:Number(root.querySelector('[data-part="workbench-wires"]')?.dataset.projectionMs??0),wires:[...root.querySelectorAll('[data-part="wire"]')].map(w=>{
        const d=w.querySelector('path')?.getAttribute('d'),nums=d?.match(/-?\d+(?:\.\d+)?/g)?.map(Number)??[],points=[];
        for(let i=0;i<nums.length;i+=2)points.push({x:nums[i],y:nums[i+1]});
        let diagonal=0,collisions=0;
        for(let i=1;i<points.length;i++) {
          const a=points[i-1],b=points[i];if(a.x!==b.x&&a.y!==b.y)diagonal++;
          for(const q of rects) {
            if(a.y===b.y&&a.y>q.top&&a.y<q.bottom&&Math.max(Math.min(a.x,b.x),q.left)<Math.min(Math.max(a.x,b.x),q.right))collisions++;
            if(a.x===b.x&&a.x>q.left&&a.x<q.right&&Math.max(Math.min(a.y,b.y),q.top)<Math.min(Math.max(a.y,b.y),q.bottom))collisions++;
          }
        }
        return {term:w.dataset.term,route:w.dataset.route,diagonal,collisions,fromError:points.length?endpointError(points[0],w.dataset.source,'out'):null,toError:points.length?endpointError(points.at(-1),w.dataset.destination,'in'):null,points};
      })};
    }));
    await page.mouse.move(width-2,2);
    await page.screenshot({path:base+'refactor-final-'+width+'.png'});
  }
  return measurements;
}
