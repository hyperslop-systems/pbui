import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { layout, tile } from "@hyperslop-systems/workbench-core";
import { defineWorkbenchApp } from "../app";
import { createWorkbench } from "../createWorkbenchShell";

afterEach(cleanup);
it("keeps application ancestry and state across wiring toggles, with decoration outside scrolling content", () => {
  let mounts=0, unmounts=0;
  const app=defineWorkbenchApp({manifest:{id:"probe",ports:[{name:"value",direction:"inout",contract:"number",doc:"Value"}]},presentation:{title:"Probe",tone:"var(--pbui-pane)",Component:()=>{
    useEffect(()=>{mounts++; return ()=>{unmounts++;};},[]);
    return <input aria-label="app state" defaultValue="retained" />;
  }}});
  const wb=createWorkbench({apps:[app],initial:layout(tile("probe"))});
  const {container,rerender}=render(<wb.Surface />);
  const input=container.querySelector("input")!;
  for(let i=0;i<3;i++) {
    act(()=>wb.dispatch({kind:"link.mode.open"}));
    const overlay=container.querySelector('[data-part="tile-frame-overlay"]')!;
    expect(overlay.parentElement?.getAttribute("data-part")).toBe("tile");
    expect(overlay.closest('[data-part="tile-scrollport"]')).toBeNull();
    expect(input.closest("[inert]")).not.toBeNull();
    rerender(<wb.Surface wiring={{mode:"focused"}} />);
    expect(container.querySelector('[data-wiring-focused]')).not.toBeNull();
    expect(container.querySelector("input")).toBe(input);
    rerender(<wb.Surface wiring={{mode:"spatial"}} />);
    act(()=>wb.dispatch({kind:"link.mode.close"}));
  }
  expect(container.querySelector("input")).toBe(input);
  expect(input.value).toBe("retained");
  expect(mounts).toBe(1); expect(unmounts).toBe(0);
});
