import { useWorkbench } from '../context';
import { useLinkSnapshot } from '../links/hooks';
import { linkRefsOf } from '../links/linkRef';
export function ConnectionInspector() {
  const wb=useWorkbench();
  const links=linkRefsOf(useLinkSnapshot(wb));
  return <details data-part="connection-inspector" style={{position:'absolute',bottom:0,left:20,right:20,zIndex:4,background:'var(--pbui-pane)',border:'var(--pbui-border-hair)',maxHeight:'35%',overflow:'auto'}}>
    <summary>Connections ({links.length}) — inspect all, including hidden endpoints</summary>
    <ul>{links.map(link=><li key={link.linkId}>{link.sourceTitle} → {link.destinationTitle} · {link.kind}{link.relationId?` · ${link.relationId}`:''}</li>)}</ul>
  </details>;
}
