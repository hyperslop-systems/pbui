import type { ReactNode } from "react";
import { JsonBlock } from "../JsonBlock";

export interface InspectedValue {
  title: string;
  value: unknown;
}

export interface InspectorPanelProps {
  inspected: InspectedValue | null;
  emptyMessage?: ReactNode;
  renderValue?: (inspected: InspectedValue) => ReactNode;
  unstyled?: boolean;
}

/** Generic structured-value inspector with an optional domain renderer. */
export function InspectorPanel({
  inspected,
  emptyMessage = "Nothing inspected yet.",
  renderValue = ({ value }) => <JsonBlock value={value} maxHeight="none" />,
  unstyled = false,
}: InspectorPanelProps) {
  return (
    <section
      data-pbui-component="inspector-panel"
      data-part="inspector-panel"
      data-state={inspected ? "populated" : "empty"}
      data-unstyled={unstyled || undefined}
    >
      {!inspected ? (
        <div data-part="inspector-empty">{emptyMessage}</div>
      ) : (
        <>
          <h3 data-part="inspector-title">{inspected.title}</h3>
          <div data-part="inspector-value">{renderValue(inspected)}</div>
        </>
      )}
    </section>
  );
}
