import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createWiringLab } from "../../stories/WiringLab.stories";
const meta: Meta = {title:"Workbench/ConnectionInspector"};
export default meta;
export const InSurface: StoryObj = {render:function InSurface(){
  const wb=useMemo(()=>createWiringLab(),[]);
  return <div style={{height:800}}><wb.Surface wiring={{mode:"focused"}}/></div>;
}};
