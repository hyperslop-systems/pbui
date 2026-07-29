import { describe, expect, test } from "vitest";
import type { AppDescriptor } from "../src/appkit/registry";
import { pickerOptions } from "../src/components/organisms/Tile/options";

/**
 * The tile's application picker: three rules that interact.
 *
 * Pure, so it is tested with literals and no DOM — which is the point of
 * extracting it out of `Tile.tsx` at all. Each of the three has a failure mode
 * that is invisible in a screenshot: an option missing looks like a shorter
 * list, and a selected option that is disabled looks like a normal select.
 *
 * ## These assertions were INVERTED by DATADROP-14 (DR-95)
 *
 * They used to require that an unavailable application be present and
 * `disabled` with a reason. The picker now omits it, so they require absence.
 *
 * That is a real reversal of a real argument — hiding an unavailable option
 * hides the rule that makes it unavailable — and the reason it is right here is
 * the ratio rather than the principle: twenty-five applications with as many as
 * twenty-two greyed buries the ones that work. `Tile/options.ts` carries the
 * argument; `pbui/verbs.ts` keeps the old rule for verb menus, which are short.
 *
 * The one rule that did NOT change is the tile's own application, and it is the
 * only one here that is a browser fact rather than a policy: a `<select>` whose
 * value matches no option renders blank and silently reassigns on the next
 * change.
 */

const app = (id: string, extra: Partial<AppDescriptor> = {}): AppDescriptor =>
  ({
    id,
    title: id,
    tone: "var(--pbui-tone-neutral)",
    docBound: false,
    duplicable: false,
    singleton: false,
    Component: (() => null) as unknown as AppDescriptor["Component"],
    ...extra,
  }) as AppDescriptor;

describe("the tile's application picker", () => {
  test("a singleton already open elsewhere is hidden", () => {
    const options = pickerOptions({
      apps: [app("chart", { duplicable: true }), app("trace", { singleton: true })],
      own: app("chart", { duplicable: true }),
      ownApp: "chart",
      elsewhere: new Set(["trace"]),
    });
    expect(options.map((option) => option.value)).toEqual(["chart"]);
  });

  test("a singleton NOT open elsewhere is offered", () => {
    const options = pickerOptions({
      apps: [app("chart"), app("trace", { singleton: true })],
      own: app("chart"),
      ownApp: "chart",
      elsewhere: new Set(),
    });
    expect(options.find((option) => option.value === "trace")?.disabled).toBeUndefined();
  });

  test("a non-singleton may appear many times", () => {
    const options = pickerOptions({
      apps: [app("chart", { duplicable: true }), app("launcher")],
      own: app("chart", { duplicable: true }),
      ownApp: "chart",
      elsewhere: new Set(["launcher", "chart"]),
    });
    expect(options.find((option) => option.value === "launcher")?.disabled).toBeUndefined();
  });

  test("an application the workspace state forbids is omitted, not greyed", () => {
    // In practice the scope levels have already filtered `apps` by the time it
    // reaches here, so `unavailable` carries only rules that depend on the
    // workspace's own state. Either way the treatment is the same: gone.
    const options = pickerOptions({
      apps: [app("chart"), app("tokens")],
      own: app("chart"),
      ownApp: "chart",
      elsewhere: new Set(),
      unavailable: (id) => id === "tokens",
    });
    expect(options.map((option) => option.value)).toEqual(["chart"]);
  });

  test("nothing the picker returns is ever disabled", () => {
    // The invariant that replaces three deleted assertions. `SelectOption` still
    // HAS a `disabled` field — MemberList and the upload form use it — so this
    // states that the picker specifically never sets it, which is what a reader
    // of SelectInput.tsx would otherwise have to guess.
    const options = pickerOptions({
      apps: [app("chart"), app("tokens"), app("trace", { singleton: true })],
      own: app("chart"),
      ownApp: "chart",
      elsewhere: new Set(["trace"]),
      unavailable: (id) => id === "tokens",
    });
    expect(options.every((option) => option.disabled === undefined)).toBe(true);
    expect(options.every((option) => option.reason === undefined)).toBe(true);
  });

  test("the tile's own application is listed even when the scope excludes it", () => {
    // A select whose value matches no option renders blank and silently
    // reassigns on the next change, so a seeded layout naming an out-of-scope
    // application would lose that tile the first time anyone touched it.
    const options = pickerOptions({
      apps: [app("chart"), app("table")],
      own: app("tokens"),
      ownApp: "tokens",
      elsewhere: new Set(),
      unavailable: () => true,
    });
    expect(options.map((option) => option.value)).toContain("tokens");
  });

  test("the tile's own application is never disabled, whatever the rules say", () => {
    // A selected <option disabled> is legal and displays, and reads as "this
    // tile is showing something it may not show" — which is not what is meant.
    const options = pickerOptions({
      apps: [app("trace", { singleton: true })],
      own: app("trace", { singleton: true }),
      ownApp: "trace",
      // Another tile also holds `trace`, which should not disable this one's
      // own entry.
      elsewhere: new Set(["trace"]),
      unavailable: () => true,
    });
    const trace = options.find((option) => option.value === "trace");
    expect(trace?.disabled).toBeUndefined();
    expect(trace?.reason).toBeUndefined();
  });

  test("an empty scope still offers the tile's own application", () => {
    // The blank-picker failure mode: compose an instance scope and a stage
    // scope with no overlap and `apps` is empty.
    const options = pickerOptions({
      apps: [],
      own: app("chart"),
      ownApp: "chart",
      elsewhere: new Set(),
    });
    expect(options).toEqual([{ value: "chart", label: "chart" }]);
  });

  test("an unknown application still produces a usable picker", () => {
    // `own` is null when a bundle named an application this build does not
    // have. The tile renders its "no application called …" state and the picker
    // must still offer a way out.
    const options = pickerOptions({
      apps: [app("chart")],
      own: null,
      ownApp: "chartsy",
      elsewhere: new Set(),
    });
    expect(options.map((option) => option.value)).toEqual(["chart"]);
  });
});
