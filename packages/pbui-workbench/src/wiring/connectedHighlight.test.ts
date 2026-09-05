import { afterEach, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { attachConnectedHighlight } from "./connectedHighlight";
import type { LinkRef } from "../links/linkRef";
const link = (id: string, source: string, destination: string): LinkRef => ({linkId:id, source, destination, sourceTitle:source, destinationTitle:destination, kind:'follow'});
function fixture() {
  const root = document.createElement('div');
  root.setAttribute('data-workbench-shell', '');
  root.innerHTML = `<section data-part="workbench-tile"><button data-port-id="a"><b>A</b></button><button data-port-id="x">X</button></section><button data-port-id="b">B</button><button data-port-id="c">C</button><svg><g data-part="wire" data-link-id="ab"><path /></g><g data-part="wire" data-link-id="bc"><path /></g><g data-part="wire" data-link-id="xc"><path /></g></svg>`;
  document.body.append(root);
  const dispose = attachConnectedHighlight(root, [link('ab','a','b'),link('bc','b','c'),link('xc','x','c')]);
  const highlighted = () => [...root.querySelectorAll('[data-connected-highlight]')].map(e=>e.getAttribute('data-port-id')??e.getAttribute('data-link-id')).sort();
  return {root, dispose, highlighted};
}
afterEach(()=>document.body.replaceChildren());
it('highlights incident wires and remote endpoints, without transitive traversal or affecting another surface',()=>{
  const a=fixture(), b=fixture();
  fireEvent.pointerOver(a.root.querySelector('b')!);
  expect(a.highlighted()).toEqual(['a','ab','b']);
  expect(b.highlighted()).toEqual([]);
  fireEvent.pointerOver(a.root.querySelector('[data-link-id="bc"] path')!);
  expect(a.highlighted()).toEqual(['b','bc','c']);
  fireEvent.pointerLeave(a.root);
  expect(a.highlighted()).toEqual([]);
  a.dispose(); b.dispose();
});
it('highlights every incident connection of a tile card and clears on disposal',()=>{
  const a=fixture();
  fireEvent.pointerOver(a.root.querySelector('section')!);
  expect(a.highlighted()).toEqual(['a','ab','b','c','x','xc']);
  a.dispose();
  expect(a.highlighted()).toEqual([]);
  fireEvent.pointerOver(a.root.querySelector('b')!);
  expect(a.highlighted()).toEqual([]);
});
it('supports keyboard focus and restores it after pointer leaves',()=>{
  const a=fixture();
  const button=a.root.querySelector('button')!;
  button.focus();
  expect(a.highlighted()).toEqual(['a','ab','b']);
  fireEvent.pointerOver(a.root.querySelector('[data-link-id="bc"] path')!);
  expect(a.highlighted()).toEqual(['b','bc','c']);
  fireEvent.pointerLeave(a.root);
  expect(a.highlighted()).toEqual(['a','ab','b']);
  button.blur();
  expect(a.highlighted()).toEqual([]);
  a.dispose();
});
