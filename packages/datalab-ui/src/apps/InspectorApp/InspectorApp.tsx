import { useSelector } from "react-redux";
import { InspectorPanel } from "@hyperslop-systems/pbui";
import { registerApp, type AppProps } from "../../appkit/registry";
import type { RootState } from "../../store";

/**
 * Whatever was last inspected — the container half.
 *
 * One selector, and nothing else. `world.inspected` is written by the `inspect`
 * verb, which every descriptor offers, so this tile shows objects of sixteen
 * presentation types without knowing about any of them.
 */
function InspectorApp(_props: AppProps) {
  const inspected = useSelector((s: RootState) => s.world.inspected);
  return (
    <InspectorPanel
      inspected={inspected}
      emptyMessage={
        <>
          Nothing inspected yet. Right-click any presentation and choose
          <strong> Inspect</strong>.
        </>
      }
    />
  );
}

registerApp({
  id: "inspector",
  title: "inspector",
  tone: "var(--pbui-tone-step)",
  docBound: false,
  duplicable: false,
  singleton: true,
  Component: InspectorApp,
});
