import { afterEach, describe, expect, it } from "vitest";
import { createGeometryStore } from "./geometryStore";

const stores: ReturnType<typeof createGeometryStore>[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.setRoot(null); document.body.replaceChildren(); });
function box(element: HTMLElement, x: number, y: number, width: number, height: number) {
  element.getBoundingClientRect = () => ({ x, y, left:x, top:y, right:x+width, bottom:y+height, width, height, toJSON: () => ({}) });
}
function fixture() {
  const store = createGeometryStore(); stores.push(store);
  const root = document.createElement("div"), frame = document.createElement("div"), clip = document.createElement("div"), card = document.createElement("button");
  root.append(frame); frame.append(clip); clip.append(card); document.body.append(root);
  clip.style.overflowY = "auto";
  box(root,100,100,500,400); box(frame,120,120,200,300); box(clip,120,150,200,100); box(card,125,160,180,30);
  store.setRoot(root); store.registerFrame("tile",frame);
  const key = { placementId:"tile",portId:"view/port",side:"out" as const };
  const dispose = store.registerAnchor(key,card);
  store.flush();
  return {store,root,frame,clip,card,key,dispose};
}
describe("surface geometry ownership", () => {
  it("tracks translation and clipped-but-mounted cards without measuring painted jacks", () => {
    const f=fixture();
    expect(f.store.getSnapshot().anchors[0]).toMatchObject({point:{x:226,y:75},visible:true});
    box(f.frame,180,120,200,300); box(f.card,185,260,180,30);
    f.store.invalidate(); expect(f.store.getSnapshot().pending).toBe(true); f.store.flush();
    expect(f.store.getSnapshot().anchors[0]).toMatchObject({point:{x:286,y:175},visible:false});
  });
  it("cleans up only the exact registration and keeps duplicate placements independent", () => {
    const f=fixture();
    const replacement=f.store.registerAnchor(f.key,f.card);
    f.dispose(); f.store.flush(); expect(f.store.getSnapshot().anchors).toHaveLength(1);
    f.store.registerFrame("duplicate",f.frame);
    f.store.registerAnchor({...f.key,placementId:"duplicate"},f.card);
    replacement(); f.store.flush();
    expect(f.store.getSnapshot().anchors.map(a=>a.key.placementId)).toEqual(["duplicate"]);
  });
  it("isolates identical IDs on two roots and ignores foreign elements", () => {
    const a=fixture(), b=fixture();
    a.store.registerAnchor({...a.key,portId:"foreign"},b.card); a.store.flush();
    expect(a.store.getSnapshot().anchors).toHaveLength(1);
    b.dispose(); b.store.flush(); expect(a.store.getSnapshot().anchors).toHaveLength(1);
  });
  it("has stable unchanged snapshots and clears geometry when the root unmounts", () => {
    const f=fixture(), old=f.store.getSnapshot();
    f.store.flush(); expect(f.store.getSnapshot()).toBe(old);
    f.store.invalidate(); f.store.setRoot(null); f.store.flush();
    expect(f.store.getSnapshot()).toMatchObject({pending:false,anchors:[]});
    expect(f.store.getSnapshot().epoch).toBeGreaterThan(old.epoch);
  });
});
