import { expect,it } from 'vitest';
import { shouldFocus,wiringMinimum } from './layoutPolicy';
import { layout,split,tile } from '@hyperslop-systems/workbench-core';
import { workspaceTree } from '@hyperslop-systems/workbench-protocol/client';
it('accounts for unbalanced ratios and uses a stable return threshold',()=>{
  const document=layout(split('row',0.25,tile('a'),tile('b')));
  const minimum=wiringMinimum(workspaceTree(document,document.workspaces[0]!.id));
  expect(minimum.width).toBe(1144);
  expect(shouldFocus({width:1200,height:900},minimum,false)).toBe(false);
  expect(shouldFocus({width:1200,height:900},minimum,true)).toBe(true);
  expect(shouldFocus({width:1250,height:900},minimum,true)).toBe(false);
});
