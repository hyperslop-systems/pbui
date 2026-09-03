import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { createWorkbench } from "../../createWorkbenchShell";
import { DEFAULT_REBALANCE_CONFIG, profileConfig, type RebalanceConfig } from "@hyperslop-systems/workbench-core/rebalance";
import {
  readRebalanceConfig,
  rebalanceConfigMutation,
  REBALANCE_CONFIG_DOC_ID,
} from "@hyperslop-systems/workbench-core/rebalance";
import type { RebalanceConfigStore } from "../../rebalance/configStore";
import { demoApps } from "../../stories/demoApps";
import { createRebalanceSettingsApp, rebalanceSettingsApp } from "./RebalanceSettings";

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
    expect(wb.apply([rebalanceConfigMutation(config)]).ok).toBe(true);
    const stored = wb.core.getState().document.documents[REBALANCE_CONFIG_DOC_ID];
    expect(stored?.format).toBe("pbui.rebalance-config");
    expect(readRebalanceConfig(wb.core.getState().document)).toEqual(config);
  });

  test("a null displacement cap (unbounded) survives the Struct round-trip", () => {
    const wb = settingsWorkbench();
    const config = profileConfig("balanced");
    expect(config.budget.dispPx).toBeNull();
    wb.apply([rebalanceConfigMutation(config)]);
    expect(readRebalanceConfig(wb.core.getState().document)?.budget.dispPx).toBeNull();
  });

  test("a missing or foreign payload reads as null, so defaults apply", () => {
    const wb = settingsWorkbench();
    expect(readRebalanceConfig(wb.core.getState().document)).toBeNull();
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
    const stored = readRebalanceConfig(wb.core.getState().document);
    expect(stored?.allow.reorder).toBe(!DEFAULT_REBALANCE_CONFIG.allow.reorder);
    expect(stored?.profile).toBe("custom");
  });

  test("a profile button seeds the config but keeps the constraints", () => {
    const wb = settingsWorkbench();
    wb.apply([rebalanceConfigMutation({ ...profileConfig("balanced"), minInlinePx: 333 })]);
    const { baseElement } = render(<wb.Surface />);
    const careful = [...baseElement.querySelectorAll("button")].find((b) => b.textContent === "CAREFUL");
    act(() => {
      fireEvent.click(careful!);
    });
    const stored = readRebalanceConfig(wb.core.getState().document);
    expect(stored?.profile).toBe("careful");
    expect(stored?.allow.topology).toBe(false);
    expect(stored?.minInlinePx).toBe(333); // constraints survive the switch
  });

  test("a product-supplied store replaces the document payload for BOTH the tile and the dialog", () => {
    // An in-memory store: what a product with its own settings backend passes.
    let current: RebalanceConfig = { ...profileConfig("balanced"), minInlinePx: 40, minBlockPx: 40 };
    const listeners = new Set<() => void>();
    const memory: RebalanceConfigStore = {
      useConfig: () =>
        useSyncExternalStore(
          (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          () => current,
        ),
      save: (_host, next) => {
        current = next;
        for (const listener of listeners) listener();
      },
    };
    const wb = createWorkbench({
      apps: [...demoApps, createRebalanceSettingsApp({ store: memory })],
      initial: layout(
        split("row", 0.5, split("row", 0.9, tile("counter"), tile("notes")), tile("rebalance-settings")),
      ),
    });
    const { baseElement } = render(
      <>
        <wb.Surface />
        <wb.Rebalance configStore={memory} />
      </>,
    );
    // The tile writes into the custom store, never into the document.
    const checkbox = [...baseElement.querySelectorAll("label")]
      .find((label) => /reorder tiles/.test(label.textContent ?? ""))
      ?.querySelector("input");
    act(() => {
      fireEvent.click(checkbox!);
    });
    expect(current.profile).toBe("custom");
    expect(wb.core.getState().document.documents[REBALANCE_CONFIG_DOC_ID]).toBeUndefined();
    // The dialog reads the same store: the 40px floor makes the layout healthy.
    act(() => {
      wb.perform({ kind: "rebalance.open" });
    });
    expect(baseElement.querySelector('[data-part="rebalance-diagnosis"]')?.textContent).toMatch(
      /every tile clears its minimum/,
    );
  });

  test("the dialog reads the persisted config: a tiny floor makes a skewed layout healthy", () => {
    const wb = createWorkbench({
      apps: [...demoApps, rebalanceSettingsApp],
      initial: layout(split("row", 0.9, tile("counter"), tile("notes"))),
    });
    wb.apply([
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
