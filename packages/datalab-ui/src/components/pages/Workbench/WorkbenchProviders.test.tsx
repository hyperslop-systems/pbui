// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Provider } from "react-redux";
import { Button } from "@hyperslop-systems/pbui";
import { AnalysisProvider } from "../../../appkit/AnalysisProvider";
import { usePbui } from "../../../pbui";
import { makeStore } from "../../../store";
import { WorkbenchProviders } from "./WorkbenchProviders";

afterEach(cleanup);

/**
 * One real composition gesture: PBUI context → WorkbenchProviders.perform →
 * actionsForVerb → Redux. This deliberately does not mock the router, because
 * the production failure mode was a provider that rendered normally while its
 * verbs had nowhere to go.
 */
function WatchFieldButton() {
  const pbui = usePbui();
  return (
    <Button
      onClick={() =>
        void pbui.perform({
          kind: "watch",
          ptype: "field",
          value: { docId: null, name: "temperature" },
        })
      }
    >
      watch field
    </Button>
  );
}

describe("WorkbenchProviders", () => {
  it("routes a PBUI verb through the production provider into Redux", () => {
    const store = makeStore({ seed: false });

    render(
      <Provider store={store}>
        <AnalysisProvider principalKey="provider-composition-test">
          <WorkbenchProviders>
            <WatchFieldButton />
          </WorkbenchProviders>
        </AnalysisProvider>
      </Provider>,
    );

    expect(store.getState().world.watch).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "watch field" }));
    expect(store.getState().world.watch).toEqual([
      expect.objectContaining({
        ptype: "field",
        value: { docId: null, name: "temperature" },
      }),
    ]);
  });
});
