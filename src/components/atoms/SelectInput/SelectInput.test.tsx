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
      label="format"
      value="csv"
      onValueChange={() => {}}
      options={[
        { value: "csv", label: "CSV" },
        // The shape a caller writes: predicate, then prose.
        { value: "parquet", label: "Parquet", disabled: true, reason: "needs a paid plan" },
        // The illegal state the type still permits until P3.2 merges the pair:
        // a reason on an option that is perfectly selectable.
        { value: "json", label: "JSON", reason: "needs a paid plan" },
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

  test("ignores a reason on an option that is not disabled", () => {
    const { json } = renderOptions();

    expect(json.disabled).toBe(false);
    // The defect: this used to be "JSON — needs a paid plan".
    expect(json.textContent).toBe("JSON");
    expect(json.title).toBe("");
  });

  test("leaves an ordinary option alone", () => {
    const { csv } = renderOptions();

    expect(csv.disabled).toBe(false);
    expect(csv.textContent).toBe("CSV");
  });
});
