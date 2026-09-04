import { Direction, type Node } from '@hyperslop-systems/workbench-protocol';
export interface MinimumSize {width:number;height:number}
/** Account for the declared ratio: one very small branch can constrain the whole tree. */
export function wiringMinimum(node:Node|undefined):MinimumSize {
  if(!node||node.body.case!=='split') return {width:280,height:180};
  const s=node.body.value,a=wiringMinimum(s.a),b=wiringMinimum(s.b);
  const ratio=Math.max(0.01,Math.min(0.99,s.ratio));
  return s.direction===Direction.COLUMN
    ?{width:Math.max(a.width,b.width),height:24+Math.max(a.height/ratio,b.height/(1-ratio))}
    :{width:24+Math.max(a.width/ratio,b.width/(1-ratio)),height:Math.max(a.height,b.height)};
}
export function shouldFocus(size:MinimumSize,minimum:MinimumSize,wasFocused:boolean) {
  const hysteresis=wasFocused?32:0;
  return size.width<minimum.width+40+hysteresis||size.height<minimum.height+156+hysteresis;
}
