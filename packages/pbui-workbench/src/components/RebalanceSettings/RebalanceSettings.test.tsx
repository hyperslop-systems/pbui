import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { createWorkbench } from "../../createWorkbench";
import { layout, split, tile } from "../../document";
import { DEFAULT_REBALANCE_CONFIG, profileConfig } from "../../rebalance/config";
import {
  readRebalanceConfig,
  rebalanceConfigMutation,
  REBALANCE_CONFIG_DOC_ID,
} from "../../rebalance/configDocument";
import { demoApps } from "../../stories/demoApps";
import { rebalanceSettingsApp } from "./RebalanceSettings";

afterEach(cleanup);

function settingsWorkbench() {
  return createWorkbench({
    apps: [...demoApps, rebalanceSettingsApp],
    initial: layout(split("row", 0.5, tile("counter"), tile("rebalance-settings"))),
  });
}

describe("rebalance config persistence", () => {
  test("the mutation round-trips through the real applier and normalizeConfig", () => {
    const wb = settingsWorkbench();
    const config = { ...profileConfig("careful"), minInlinePx: 300, hystPx: 12 };
    expect(wb.mutate([rebalanceConfigMutation(config)])).toBe(true);
    const stored = wb.store.getState().document.documents[REBALANCE_CONFIG_DOC_ID];
    expect(stored?.format).toBe("pbui.rebalance-config");
    expect(readRebalanceConfig(wb.store.getState().document)).toEqual(config);
  });

  test("a null displacement cap (unbounded) survives the Struct round-trip", () => {
    const wb = settingsWorkbench();
    const config = profileConfig("balanced");
    expect(config.budget.dispPx).toBeNull();
    wb.mutate([rebalanceConfigMutation(config)]);
    expect(readRebalanceConfig(wb.store.getState().document)?.budget.dispPx).toBeNull();
  });

  test("a missing or foreign payload reads as null, so defaults apply", () => {
    const wb = settingsWorkbench();
    expect(readRebalanceConfig(wb.store.getState().document)).toBeNull();
  });
});

describe("RebalanceSettings tile", () => {
  test("toggling an allow flag writes the payload and flips the profile to custom", () => {
    const wb = settingsWorkbench();
    const { baseElement } = render(<wb.Surface />);
    const checkbox = [...baseElement.querySelectorAll("label")].find((label) =>
      /reorder tiles/.test(label.textContent ?? ""),
    )?.querySelector("input");
    expect(checkbox).toBeDefined();
    expect(checkbox?.checked).toBe(DEFAULT_REBALANCE_CONFIG.allow.reorder);
    act(() => {
      fireEvent.click(checkbox!);
    });
    const stored = readRebalanceConfig(wb.store.getState().document);
    expect(stored?.allow.reorder).toBe(!DEFAULT_REBALANCE_CONFIG.allow.reorder);
    expect(stored?.profile).toBe("custom");
  });

  test("a profile button seeds the config but keeps the constraints", () => {
    const wb = settingsWorkbench();
    wb.mutate([rebalanceConfigMutation({ ...profileConfig("balanced"), minInlinePx: 333 })]);
    const { baseElement } = render(<wb.Surface />);
    const careful = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "CAREFUL");
    act(() => {
      fireEvent.click(careful!);
    });
    const stored = readRebalanceConfig(wb.store.getState().document);
    expect(stored?.profile).toBe("careful");
    expect(stored?.allow.topology).toBe(false);
    expect(stored?.minInlinePx).toBe(333); // constraints survive the switch
  });

  test("the dialog reads the persisted config: a tiny floor makes a skewed layout healthy", () => {
    const wb = createWorkbench({
      apps: [...demoApps, rebalanceSettingsApp],
      initial: layout(split("row", 0.9, tile("counter"), tile("notes"))),
    });
    wb.mutate([
      rebalanceConfigMutation({ ...profileConfig("balanced"), minInlinePx: 40, minBlockPx: 40 }),
    ]);
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance />
      </>,
    );
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    // At the default 240px floor this layout is broken; at the persisted 40px
    // floor it is healthy — proving the dialog consumed the payload.
    expect(baseElement.querySelector('[data-part="rebalance-diagnosis"]')?.textContent).toMatch(
      /every tile clears its minimum/,
    );
  });
});
