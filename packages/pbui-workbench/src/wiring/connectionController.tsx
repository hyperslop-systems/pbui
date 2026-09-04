import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useEscapeSurface } from '@hyperslop-systems/pbui';
import type { WorkbenchCommand } from '@hyperslop-systems/workbench-core';
import { useWorkbench } from '../context';
import { useGeometryStore } from './geometryContext';
import { connectionCommands, type ConnectionOperation } from './connectionCommands';
import type { WiringOptions } from '../types';
function useController(enabled:boolean,options:WiringOptions,focused:boolean) {
  const wb=useWorkbench(),geometry=useGeometryStore()!;
  const [source,setSource]=useState(''),[operation,setOperation]=useState<ConnectionOperation>('follow'),[relation,setRelation]=useState(wb.links.deps.relations?.[0]?.id??'');
  const [message,setMessage]=useState('Choose an output, then an input.'),[selected,setSelected]=useState<readonly string[]>([]);
  const drag=useRef<{source:string;x:number;y:number;pointer:number;root:HTMLElement;moved:boolean}|null>(null);
  const suppressClick=useRef(false),returnFocus=useRef<HTMLElement|null>(null);
  const top=useEscapeSurface(enabled);
  const preview=(destination:string)=>wb.preview(connectionCommands(source,destination,operation,relation));
  const execute=(commands:readonly WorkbenchCommand[])=>{
    const result=wb.execute(commands);
    setMessage(result.ok?'Connection updated.':result.because);
    return result.ok;
  };
  const connect=(destination:string,from=source)=>{
    if(!from) {setMessage('Choose an output first.');return false;}
    const ok=execute(connectionCommands(from,destination,operation,relation));
    if(ok) setSource('');
    return ok;
  };
  const choose=(port:string,side:'in'|'out')=>{
    if(suppressClick.current) {suppressClick.current=false;return;}
    if(side==='out') {setSource(port);setMessage('Source selected. Choose an input.');} else connect(port);
  };
  const cancelDrag=()=>{
    const active=drag.current; drag.current=null;
    if(active?.root.hasPointerCapture?.(active.pointer)) active.root.releasePointerCapture(active.pointer);
  };
  useEffect(()=>{cancelDrag();},[focused]);
  const cancel=()=>{
    const active=drag.current; drag.current=null;
    if(active?.root.hasPointerCapture?.(active.pointer)) active.root.releasePointerCapture(active.pointer);
    setSource('');setMessage('Connection choice cancelled.');
  };
  const begin=(source:string,event:React.PointerEvent)=>{
    if(event.button!==0) return;
    const root=geometry.root();if(!root) return;
    suppressClick.current=false;
    drag.current={source,x:event.clientX,y:event.clientY,pointer:event.pointerId,root,moved:false};

  };
  useEffect(()=>{
    if(!enabled) return;
    const root=geometry.root();if(!root) return;
    const move=(e:PointerEvent)=>{const d=drag.current;if(d&&e.pointerId===d.pointer&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>5){if(!d.moved) d.root.setPointerCapture?.(e.pointerId);d.moved=true;setSource(d.source);}};
    const up=(e:PointerEvent)=>{
      const d=drag.current;if(!d||d.pointer!==e.pointerId) return;
      drag.current=null;
      if(d.root.hasPointerCapture?.(d.pointer)) d.root.releasePointerCapture(d.pointer);
      if(!d.moved) return;
      suppressClick.current=true;
      window.setTimeout(()=>{suppressClick.current=false;},0);
      const target=document.elementFromPoint?.(e.clientX,e.clientY)?.closest<HTMLElement>('[data-port-id][data-side="in"]');
      if(target?.closest('[data-workbench-shell]')===root) connect(target.dataset.portId!,d.source);
      else setMessage('No input here. Source remains selected.');
    };
    const lost=()=>{drag.current=null;};
    root.addEventListener('pointermove',move); root.addEventListener('pointerup',up);root.addEventListener('pointercancel',lost);root.addEventListener('lostpointercapture',lost);
    return ()=>{root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',up);root.removeEventListener('pointercancel',lost);root.removeEventListener('lostpointercapture',lost);};
  },[enabled,source,operation,relation,geometry,wb]);
  useEffect(()=>{
    if(!enabled) return;
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    return ()=>{cancel(); const el=returnFocus.current; if(el?.isConnected) el.focus();else geometry.root()?.focus();};
  },[enabled]);
  useEffect(()=>{
    if(!enabled||!top) return;
    const key=(event:KeyboardEvent)=>{
      if(event.key!=='Escape') return;
      event.preventDefault();event.stopPropagation();
      if(source||drag.current) cancel();else wb.dispatch({kind:'link.mode.close'});
    };
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  },[enabled,top,source,wb]);
  return {source,operation,relation,message,selected,setSelected,setOperation,setRelation,choose,begin,preview,connect,execute,cancel,options};
}
type Controller=ReturnType<typeof useController>;
const ConnectionContext=createContext<Controller|null>(null);
export const useConnectionController=()=>useContext(ConnectionContext)!;
export function ConnectionProvider({enabled,options,focused,children}:{enabled:boolean;options:WiringOptions;focused:boolean;children:ReactNode}) {
  const controller=useController(enabled,options,focused);
  return <ConnectionContext.Provider value={controller}>{children}</ConnectionContext.Provider>;
}
