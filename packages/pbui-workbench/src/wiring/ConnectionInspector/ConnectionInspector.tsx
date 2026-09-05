import { Button, SelectInput } from "@hyperslop-systems/pbui";
import { useEffect, useRef, useState } from 'react';
import type { WorkbenchCommand } from '@hyperslop-systems/workbench-core';
import { useWorkbench } from '../../context';
import { useLinkSnapshot } from '../../links/hooks';
import { linkRefsOf } from '../../links/linkRef';
import { useConnectionController } from '.././connectionController';
import type { ConnectionOperation } from '.././connectionCommands';
import { useGeometryStore } from '.././geometryContext';
import styles from './ConnectionInspector.module.css';
export function ConnectionInspector({focused=false,mode="auto",onMode}:{focused?:boolean;mode?:"auto"|"spatial"|"focused";onMode?:(mode:"auto"|"spatial"|"focused")=>void}) {
  const geometry=useGeometryStore()!;
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(focused) panel.current?.querySelector<HTMLSelectElement>('[aria-label="Connection operation"]')?.focus();},[focused]);
  const wb=useWorkbench(),controller=useConnectionController(),snapshot=useLinkSnapshot(wb);
  const links=linkRefsOf(snapshot),ports=[...snapshot.ports.values()];
  const [destination,setDestination]=useState('');
  const preview=controller.source&&destination?controller.preview(destination):null;
  const action=(label:string,command:WorkbenchCommand)=>{
    const result=wb.preview(command);
    return <Button variant="framed" size="tiny" key={label} type="button" disabled={!result.ok} title={result.ok?label:result.because} onClick={()=>controller.execute([command])}>{label}</Button>;
  };
  return <div ref={panel} data-part="connection-inspector" data-focused={focused||undefined} className={styles.panel}>
    <div className={styles.controls}>
      <label>View <SelectInput size="tiny" accessibleName="Wiring view" value={mode} onValueChange={value=>onMode?.(value as "auto"|"spatial"|"focused")} options={['auto','spatial','focused'].map(value=>({value,label:value}))}/></label>
      <label>Operation <SelectInput size="tiny" accessibleName="Connection operation" value={controller.operation} onValueChange={value=>controller.setOperation(value as ConnectionOperation)} options={['follow','hold','share','derive'].map(value=>({value,label:value}))}/></label>
      {controller.operation==='derive'?<label>Relation <SelectInput size="tiny" accessibleName="Derived relation" value={controller.relation} onValueChange={controller.setRelation} options={(wb.links.deps.relations??[]).map(r=>({value:r.id,label:r.label??r.id}))}/></label>:null}
      <label>Source <SelectInput size="tiny" accessibleName="Connection source" value={controller.source} onValueChange={value=>controller.choose(value,'out')} placeholder="Choose output" options={ports.filter(p=>p.declaration.direction!=='in').map(p=>({value:p.id,label:`${p.tileTitle} · ${p.declaration.name}`}))}/></label>
      <label>Destination <SelectInput size="tiny" accessibleName="Connection destination" value={destination} onValueChange={setDestination} placeholder="Choose input" options={ports.filter(p=>p.declaration.direction!=='out').map(p=>({value:p.id,label:`${p.tileTitle} · ${p.declaration.name}`}))}/></label>
      <Button variant="framed" size="tiny" type="button" disabled={!preview?.ok} onClick={()=>controller.connect(destination)}>Connect</Button>
      <Button variant="framed" size="tiny" type="button" onClick={controller.cancel}>Cancel choice</Button>
      <Button variant="framed" size="tiny" type="button" onClick={()=>wb.dispatch({kind:'link.mode.close'})}>Close wiring</Button>
    </div>
    <p role="status" className={styles.status}>{preview&&!preview.ok?preview.because:controller.message}</p>
    <details open={focused||controller.selected.length>0||undefined}>
      <summary>Connections ({links.length}) — including hidden endpoints</summary>
      {controller.selected.length>1?<p>Several wires overlap here. Choose the intended connection below.</p>:null}
      <ul className={styles.list}>{links.filter(link=>!controller.selected.length||controller.selected.includes(link.linkId)).map(link=><li key={link.linkId} data-link-id={link.linkId}>
        <strong>{link.sourceTitle} → {link.destinationTitle}</strong> · {link.kind}{link.relationId?` · ${link.relationId}`:''}
        <div className={styles.actions}>
          {link.kind==='identity'?(['history','copy','reset'] as const).map(splitPolicy=>action(`Unshare (${splitPolicy})`,{kind:'identity.remove',linkId:link.linkId,splitPolicy})): <>
            {action(link.kind==='held'?'Resume':'Hold',{kind:link.kind==='held'?'port.resume':'port.pin',port:link.destination})}
            {action('Detach value',{kind:'port.detach',port:link.destination})}
            {(['freeze','clear','ambient'] as const).map(policy=>action(`Unlink (${policy})`,{kind:'port.unlink',linkId:link.linkId,policy}))}
          </>}
          {[link.source,link.destination].map((port,i)=><Button variant="framed" size="tiny" key={port} onClick={()=>{
            const anchor=geometry.getSnapshot().anchors.find(a=>a.key.portId===port);
            if(anchor) {geometry.reveal(anchor.id); geometry.element(anchor.id)?.querySelector<HTMLButtonElement>('button')?.focus();}
          }} disabled={focused}>Reveal {i===0?'source':'destination'}</Button>)}
          {controller.options.renderRelationDetails?.(link)}
        </div>
      </li>)}</ul>
      {controller.selected.length?<Button variant="framed" size="tiny" onClick={()=>controller.setSelected([])}>Show all connections</Button>:null}
    </details>
  </div>;
}
