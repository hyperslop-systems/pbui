import {
  algebra,
  annotation,
  coordinate,
  guide,
  transform,
  composition,
  geom,
  layer,
  plot,
  position,
  presence,
  presentation,
  scale,
  stat,
  value,
  variable,
} from "@hyperslop-systems/plot/author";
import { fieldId, layerId, plotId, variableId } from "@hyperslop-systems/plot";
import { describe, expect, it } from "vitest";
import { PLOT_AUTHOR_SHIM, PLOT_AUTHOR_SHIM_NAMES } from "./authorShim";

/** Evaluate one expression against the shim alone, as a program would see it. */
const inShim = (expression: string): unknown => new Function(`${PLOT_AUTHOR_SHIM}\nreturn (${expression});`)();

const v = (id: string) => value.variable(variableId(id));

/**
 * One case per exported constructor. The shim is a hand-written copy of
 * `plot/src/author/*.ts`; this is what keeps it from rotting when the real
 * package changes a field.
 */
const CASES: Array<[string, unknown]> = [
  // plot / layer
  ["plot({ id: 'p', variables: {}, composition: { dimensions: {} }, layers: [] })", plot({ id: plotId("p"), variables: {}, composition: { dimensions: {} }, layers: [] })],
  ["layer({ id: 'l', stat: stat.identity(), geom: geom.point(), position: position.identity() })", layer({ id: layerId("l"), stat: stat.identity(), geom: geom.point(), position: position.identity() })],
  // variable
  ["variable.field('field:x')", variable.field(fieldId("field:x"))],
  ["variable.field('field:x', { label: 'X' })", variable.field(fieldId("field:x"), { label: "X" })],
  ["variable.constant(3)", variable.constant(3)],
  ["variable.derived({ kind: 'field', fieldId: 'field:x' }, { label: 'd' })", variable.derived({ kind: "field", fieldId: fieldId("field:x") } as never, { label: "d" })],
  ["variable.unity()", variable.unity()],
  ["variable.unity({ label: 'one' })", variable.unity({ label: "one" })],
  // value
  ["value.variable('a')", v("a")],
  ["value.afterStat('fit')", value.afterStat("fit")],
  ["value.constant('c')", value.constant("c")],
  // composition
  ["composition.cartesian({})", composition.cartesian({})],
  ["composition.cartesian({ x: value.variable('a') })", composition.cartesian({ x: v("a") })],
  ["composition.cartesian({ x: value.variable('a'), y: value.variable('b'), groups: [value.variable('g')] })", composition.cartesian({ x: v("a"), y: v("b"), groups: [v("g")] })],
  ["composition.cartesian({ x: value.variable('a'), facets: { columns: [value.variable('f')], scales: 'fixed' } })", composition.cartesian({ x: v("a"), facets: { columns: [v("f")], scales: "fixed" } as never })],
  ["composition.algebra({ kind: 'unity' })", composition.algebra({ kind: "unity" } as never)],
  // geom
  ["geom.point()", geom.point()],
  ["geom.point({ size: 3 })", geom.point({ size: 3 } as never)],
  ["geom.line()", geom.line()],
  ["geom.bar()", geom.bar()],
  ["geom.area()", geom.area()],
  ["geom.errorbar()", geom.errorbar()],
  ["geom.ribbon()", geom.ribbon()],
  ["geom.boxplot()", geom.boxplot()],
  // stat
  ["stat.identity()", stat.identity()],
  ["stat.summary({ fn: 'mean' })", stat.summary({ fn: "mean" } as never)],
  ["stat.bin()", stat.bin()],
  ["stat.bin({ bins: 12 })", stat.bin({ bins: 12 } as never)],
  ["stat.regression({ method: 'ols' })", stat.regression({ method: "ols" } as never)],
  ["stat.boxplot()", stat.boxplot()],
  ["stat.density()", stat.density()],
  // position
  ["position.identity()", position.identity()],
  ["position.stack()", position.stack()],
  ["position.fill()", position.fill()],
  ["position.dodge()", position.dodge()],
  ["position.jitter({ width: 0.2, seed: 1 })", position.jitter({ width: 0.2, seed: 1 } as never)],
  // scale
  ["scale.linear()", scale.linear()],
  ["scale.linear({ zero: true })", scale.linear({ zero: true })],
  ["scale.log()", scale.log()],
  ["scale.temporal()", scale.temporal()],
  ["scale.band()", scale.band()],
  ["scale.categorical()", scale.categorical()],
  ["scale.colorLinear()", scale.colorLinear()],
  ["scale.size()", scale.size()],
  ["scale.shape()", scale.shape()],
  ["scale.opacity()", scale.opacity()],
  // algebra
  ["algebra.variable('a')", algebra.variable(variableId("a"))],
  ["algebra.unity()", algebra.unity()],
  ["algebra.cross(algebra.variable('a'), algebra.unity())", algebra.cross(algebra.variable(variableId("a")), algebra.unity())],
  ["algebra.nest(algebra.variable('a'), algebra.variable('b'))", algebra.nest(algebra.variable(variableId("a")), algebra.variable(variableId("b")))],
  ["algebra.nest(algebra.variable('a'), algebra.variable('b'), { id: 'n' })", algebra.nest(algebra.variable(variableId("a")), algebra.variable(variableId("b")), { id: variableId("n") })],
  ["algebra.blend([algebra.unity()])", algebra.blend([algebra.unity()])],
  ["algebra.blend([algebra.unity()], { valueId: 'v', discriminatorId: 'd' })", algebra.blend([algebra.unity()], { valueId: variableId("v"), discriminatorId: variableId("d") })],
  // presence / presentation
  ["presence.auto()", presence.auto()],
  ["presence.none()", presence.none()],
  ["presence.configured({ side: 'top' })", presence.configured({ side: "top" })],
  ["presentation.compact()", presentation.compact()],
  ["presentation.compact({ padding: 8 })", presentation.compact({ padding: 8 })],
  // annotation
  ["annotation.rule({ id: 'a', channel: 'y', value: { kind: 'constant', value: 30 }, label: 'Target', intent: 'target' })",
     annotation.rule({ id: "a" as never, channel: "y", value: value.constant(30), label: "Target", intent: "target" })],
  ["annotation.text({ id: 't', anchor: { kind: 'panel', x: 0.5, y: 0.9 }, text: 'hi' })", annotation.text({ id: "t" as never, anchor: { kind: "panel", x: 0.5, y: 0.9 }, text: "hi" })],
  ["annotation.region({ id: 'r', from: { kind: 'panel', x: 0, y: 0 }, to: { kind: 'panel', x: 1, y: 0.2 } })",
     annotation.region({ id: "r" as never, from: { kind: "panel", x: 0, y: 0 }, to: { kind: "panel", x: 1, y: 0.2 } })],
  ["annotation.point({ id: 'p', anchor: { kind: 'panel', x: 0.1, y: 0.1 } })", annotation.point({ id: "p" as never, anchor: { kind: "panel", x: 0.1, y: 0.1 } })],
  // coordinate
  ["coordinate.cartesian()", coordinate.cartesian()],
  ["coordinate.transpose()", coordinate.transpose()],
  ["coordinate.polar({ theta: 'x', startAngle: -1.5, direction: 'clockwise', innerRadius: 0.16 })", coordinate.polar({ theta: "x", startAngle: -1.5, direction: "clockwise", innerRadius: 0.16 })],
  // guide
  ["guide.axis({ label: 'Day', side: 'top', grid: 'major' })", guide.axis({ label: "Day", side: "top", grid: "major" })],
  ["guide.legend({ title: 'Shift', orientation: 'horizontal' })", guide.legend({ title: "Shift", orientation: "horizontal" })],
  // transform
  ["transform.variable('v')", transform.variable(variableId("v"))],
  ["transform.unary('abs', transform.variable('v'))", transform.unary("abs", transform.variable(variableId("v")))],
  ["transform.binary('add', transform.variable('a'), transform.variable('b'))", transform.binary("add", transform.variable(variableId("a")), transform.variable(variableId("b")))],
  ["transform.log(transform.variable('v'))", transform.log(transform.variable(variableId("v")))],
  ["transform.sqrt(transform.variable('v'))", transform.sqrt(transform.variable(variableId("v")))],
  ["transform.cut(transform.variable('v'), [1, 2, 3])", transform.cut(transform.variable(variableId("v")), [1, 2, 3])],
  // erased ids
  ["plotId('p')", plotId("p")],
  ["variableId('v')", variableId("v")],
  ["fieldId('f')", fieldId("f")],
  ["layerId('l')", layerId("l")],
];

describe("the plot author shim", () => {
  it.each(CASES)("%s matches the real author API", (expression, expected) => {
    expect(inShim(expression)).toEqual(expected);
  });

  it("declares exactly the names it advertises, and nothing else leaks", () => {
    for (const name of PLOT_AUTHOR_SHIM_NAMES) {
      expect(typeof inShim(name), name).toMatch(/function|object/);
    }
    // No `var`, no globalThis writes: the shim is `const` only.
    expect(PLOT_AUTHOR_SHIM).not.toMatch(/\bvar\b|globalThis|window|import\b|require\(/);
  });

  it("is plain JavaScript with no imports, so it can be prepended under QuickJS", () => {
    expect(() => new Function(PLOT_AUTHOR_SHIM)).not.toThrow();
  });
});
