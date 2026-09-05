import { expect, it } from 'vitest';
import { routeOrthogonal } from './route';
import { inflate, validPath } from './validate';
import fixture from '../fixtures/resize-768.json';
const bounds={left:-18,top:-18,right:fixture.capture.surface.width+18,bottom:fixture.capture.surface.height+18};
const obstacles=fixture.capture.tiles.map(t=>({left:t.x,top:t.y,right:t.x+t.width,bottom:t.y+t.height}));
it('routes captured resize failures with exact endpoints, orthogonality, and obstacle clearance',()=>{
  const start=performance.now();
  const metrics=[];
  for(const wire of fixture.capture.wires) {
    const from=wire.points[0]!,to=wire.points.at(-1)!;
    const result=routeOrthogonal(from,to,obstacles,bounds);
    expect(result.kind).toBe('valid');
    if(result.kind==='valid') {
      expect(validPath(result.points,from,to,obstacles.map(r=>inflate(r,3.5)),bounds)).toBe(true);
      metrics.push({vertices:result.vertices,expanded:result.expanded});
    }
  }
  console.info('captured resize routing',JSON.stringify({milliseconds:performance.now()-start,metrics}));
});
it('reports blocked endpoints and bounded search without an invented fallback',()=>{
  expect(routeOrthogonal({x:10,y:10},{x:90,y:10},[{left:0,top:0,right:20,bottom:20}],{left:0,top:0,right:100,bottom:100}).kind).toBe('unresolved');
  expect(routeOrthogonal({x:10,y:10},{x:90,y:20},[],{left:0,top:0,right:100,bottom:100},{maxVertices:1})).toMatchObject({kind:'unresolved',reason:'budget-exceeded'});
});
it('respects reversed attachments and retains only validated previous geometry',()=>{
  const from={x:80,y:20},to={x:20,y:80},b={left:0,top:0,right:100,bottom:100};
  const result=routeOrthogonal(from,to,[],b,{fromSide:'in',toSide:'out',previous:[from,{x:40,y:70},to]});
  expect(result.kind).toBe('valid');
  if(result.kind==='valid') expect(validPath(result.points,from,to,[],b,'in','out')).toBe(true);
});
