// Verify an existing API used by the proposed refactoring. No product edits.
// Uses the local built core, not a freshly rebuilt production artifact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createWorkbenchCore, createWorkbenchLinks, defineAppManifest,
  layout, split, tile,
} from '../../../../../../packages/workbench-core/dist/index.js';

function exercise(withValue) {
  const apps = [
    defineAppManifest({id:'source',ports:[{name:'value',direction:'out',contract:'number',doc:'Source'}]}),
    defineAppManifest({id:'sink',ports:[{name:'value',direction:'in',contract:'number',doc:'Sink'}]}),
  ];
  const links = createWorkbenchLinks();
  const core = createWorkbenchCore({apps,links,ownership:'freeze',
    initial:layout(split('row',0.5,tile('source'),tile('sink')))});
  const [sourceView,sinkView] = core.getState().document.viewOrder;
  const source = sourceView+'/value', destination = sinkView+'/value';
  if (withValue) links.runtime.emit(source,{type:'number',value:42});
  const commands = [
    {kind:'port.follow',source,destination},
    {kind:'port.pin',port:destination},
  ];
  const before = core.serialize();
  let publications=0;
  const unsubscribe=core.subscribe(()=>publications++);
  const preview=core.preview(commands);
  assert.equal(core.serialize(),before);
  assert.equal(publications,0);
  const execution=core.execute(commands);
  const binding=links.snapshot(core.getState().document).bindings.get(destination);
  if (withValue) {
    assert.equal(preview.ok,true);
    assert.equal(execution.ok,true);
    assert.equal(binding?.kind,'hold');
    assert.equal(publications,1);
  } else {
    assert.equal(preview.ok,false);
    assert.equal(execution.ok,false);
    assert.equal(core.serialize(),before);
    assert.equal(binding,undefined);
    assert.equal(publications,0);
  }
  unsubscribe();
  return {withValue,preview,execution,binding:binding??null,publications};
}
const result={scope:'Local built core; source planner independently inspected',cases:[exercise(false),exercise(true)]};
const target=new URL('../design-doc/refactor-assets/atomic-hold-probe.json',import.meta.url);
fs.mkdirSync(new URL('../design-doc/refactor-assets/',import.meta.url),{recursive:true});
fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
