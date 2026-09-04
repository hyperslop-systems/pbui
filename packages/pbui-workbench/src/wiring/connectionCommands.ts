import type { WorkbenchCommand } from '@hyperslop-systems/workbench-core';
export type ConnectionOperation='follow'|'hold'|'share'|'derive';
export function connectionCommands(source:string,destination:string,operation:ConnectionOperation,relation:string):readonly WorkbenchCommand[] {
  if(operation==='share') return [{kind:'identity.add',left:source,right:destination,mergePolicy:'prefer-left'}];
  if(operation==='derive') return [{kind:'port.derive',source,destination,relation}];
  const follow:WorkbenchCommand={kind:'port.follow',source,destination};
  return operation==='hold'?[follow,{kind:'port.pin',port:destination}]:[follow];
}
