/**
 * A `SelectOption`'s reason belongs to a disabled option.
 *
 * `SelectInput` grew the same disabled/reason pair as the object menu, by hand,
 * and guarded it the same wrong way — down to the em dash:
 *
 *     {option.reason ? `${option.label} — ${option.reason}` : option.label}
 *
 * A selectable option would have read "Parquet — needs a paid plan" while
 * selecting it worked fine. Unlike the object menu's copy this never shipped,
 * for one reason only: no caller passes `reason` yet. Three components in this
 * library have the pair and two guarded it wrong, which is the count that
 * decided P3's merge.
 *
 * These tests exist because "no caller uses it yet" is exactly the state in
 * which a defect survives review. The first caller would have shipped it.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { SelectInput } from "./SelectInput";

afterEach(cleanup);

function renderOptions() {
  render(
    <SelectInput
      accessibleName="format"
      value="csv"
      onValueChange={() => {}}
      options={[
        { value: "csv", label: "CSV" },
        { value: "parquet", label: "Parquet", disabledBecause: "needs a paid plan" },
        /*
         * There used to be a third option here — a `reason` on an option with
         * no `disabled` — to pin the behaviour for the illegal state the old
         * two-field type permitted. P3.2 merged the pair, so that state is no
         * longer expressible and the case is gone with it. A test that can no
         * longer be written is the strongest form of this fix.
         */
        { value: "json", label: "JSON" },
      ]}
    />,
  );
  const option = (name: RegExp) => screen.getByRole("option", { name }) as HTMLOptionElement;
  return { csv: option(/^CSV/), parquet: option(/^Parquet/), json: option(/^JSON/) };
}

describe("SelectInput options", () => {
  test("appends the reason to a disabled option", () => {
    const { parquet } = renderOptions();

    expect(parquet.disabled).toBe(true);
    expect(parquet.textContent).toBe("Parquet — needs a paid plan");
    expect(parquet.title).toBe("needs a paid plan");
  });

  test("leaves an option with no reason selectable and unannotated", () => {
    const { json } = renderOptions();

    expect(json.disabled).toBe(false);
    expect(json.textContent).toBe("JSON");
    expect(json.title).toBe("");
  });

  test("leaves an ordinary option alone", () => {
    const { csv } = renderOptions();

    expect(csv.disabled).toBe(false);
    expect(csv.textContent).toBe("CSV");
  });
});
