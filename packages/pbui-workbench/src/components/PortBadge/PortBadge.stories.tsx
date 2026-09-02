import type { Meta, StoryObj } from "@storybook/react-vite";
import { terms, type Badge, type BadgeState } from "@hyperslop-systems/pbui";
import { PortBadge } from "./PortBadge";

const meta: Meta = { title: "Workbench/PortBadge" };
export default meta;

const badge = (state: BadgeState, glyph: string, text: string, explanation: string): Badge => ({
  port: "v-1/order",
  name: "order",
  state,
  glyph,
  text,
  explanation,
  binding: terms.ambient("workspace.order"),
  evaluation: { kind: "empty", provenance: terms.ambient("workspace.order"), path: ["v-1/order"] },
});

const ALL: Badge[] = [
  badge("ambient", "○", "order · order", "order reads the workspace.order context, now order 1042"),
  badge("empty", "○", "order · none", "order reads the workspace.order context, which is empty"),
  badge("following", "→", "Orders East", "order follows Orders East, now order 1042"),
  badge("held", "⏸", "order 1042", "order is held on order 1042; resume follows Orders East"),
  badge("fixed", "•", "order 1042", "order is fixed on order 1042"),
  badge("shared", "≡", "selection · σ2", "selection shares the σ2 cell"),
  badge("derived", "←", "customer ← order.customer", "customer derives through order.customer from Orders East"),
  badge("unresolved", "⚠", "order", "order: the source tile was closed"),
];

export const EveryState: StoryObj = {
  name: "every badge state, as it sits after a tile title",
  render: () => (
    <div style={{ display: "grid", gap: 10, padding: 12, fontFamily: "monospace", fontSize: 13 }}>
      {ALL.map((b) => (
        <div key={b.state}>
          <span>ORDER DETAIL</span>
          <PortBadge badge={b} />
          <span style={{ opacity: 0.5, marginLeft: 12 }}>{b.state}</span>
        </div>
      ))}
    </div>
  ),
};
