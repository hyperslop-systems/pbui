import { useEffect, useRef, useState } from 'react';
import type { WorkbenchCommand } from '@hyperslop-systems/workbench-core';
import { useWorkbench } from '../context';
import { useLinkSnapshot } from '../links/hooks';
import { linkRefsOf } from '../links/linkRef';
import { useConnectionController } from './connectionController';
import type { ConnectionOperation } from './connectionCommands';
import { useGeometryStore } from './geometryContext';
import styles from './inspector.module.css';
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
    return <button key={label} type="button" disabled={!result.ok} title={result.ok?label:result.because} onClick={()=>controller.execute([command])}>{label}</button>;
  };
  return <div ref={panel} data-part="connection-inspector" data-focused={focused||undefined} className={styles.panel}>
    <div className={styles.controls}>
      <label>View <select aria-label="Wiring view" value={mode} onChange={e=>onMode?.(e.target.value as "auto"|"spatial"|"focused")}><option value="auto">Auto</option><option value="spatial">Spatial</option><option value="focused">Focused</option></select></label>
      <label>Operation <select aria-label="Connection operation" value={controller.operation} onChange={e=>controller.setOperation(e.target.value as ConnectionOperation)}>{['follow','hold','share','derive'].map(op=><option key={op} value={op}>{op}</option>)}</select></label>
      {controller.operation==='derive'?<label>Relation <select aria-label="Derived relation" value={controller.relation} onChange={e=>controller.setRelation(e.target.value)}>{(wb.links.deps.relations??[]).map(r=><option key={r.id} value={r.id}>{r.label??r.id}</option>)}</select></label>:null}
      <label>Source <select aria-label="Connection source" value={controller.source} onChange={e=>controller.choose(e.target.value,'out')}><option value="">Choose output</option>{ports.filter(p=>p.declaration.direction!=='in').map(p=><option key={p.id} value={p.id}>{p.tileTitle} · {p.declaration.name}</option>)}</select></label>
      <label>Destination <select aria-label="Connection destination" value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Choose input</option>{ports.filter(p=>p.declaration.direction!=='out').map(p=><option key={p.id} value={p.id}>{p.tileTitle} · {p.declaration.name}</option>)}</select></label>
      <button type="button" disabled={!preview?.ok} onClick={()=>controller.connect(destination)}>Connect</button>
      <button type="button" onClick={controller.cancel}>Cancel choice</button>
      <button type="button" onClick={()=>wb.dispatch({kind:'link.mode.close'})}>Close wiring</button>
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
          {[link.source,link.destination].map((port,i)=><button key={port} onClick={()=>{
            const anchor=geometry.getSnapshot().anchors.find(a=>a.key.portId===port);
            if(anchor) {geometry.reveal(anchor.id); geometry.element(anchor.id)?.querySelector<HTMLButtonElement>('button')?.focus();}
          }} disabled={focused}>Reveal {i===0?'source':'destination'}</button>)}
          {controller.options.renderRelationDetails?.(link)}
        </div>
      </li>)}</ul>
      {controller.selected.length?<button onClick={()=>controller.setSelected([])}>Show all connections</button>:null}
    </details>
  </div>;
}
