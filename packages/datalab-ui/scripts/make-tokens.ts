/*
 * Regenerate the categorical palette block in src/styles/tokens.css from the
 * palette exported by @hyperslop-systems/plot.
 *
 *   pnpm tokens
 *
 * The palette has to exist twice. buildPlot is a pure function with no access
 * to the DOM, so it puts a concrete colour on every mark; the CSS tokens colour
 * the legend swatches that claim to describe those marks. If the two drift, the
 * legend lies — and it is a bug that survives review, because each half looks
 * correct in isolation.
 *
 * @hyperslop-systems/plot is authoritative. This script only rewrites the region between
 * the BEGIN/END markers, so the surrounding comments and hand-written tokens
 * are preserved. test/tokens.test.ts is the actual guarantee: this script is a
 * convenience, and a convenience can fall out of use.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CATEGORICAL_COLORS as PALETTE,
  QUANTITATIVE_RAMP_HIGH as RAMP_HIGH,
  QUANTITATIVE_RAMP_LOW as RAMP_LOW,
} from "@hyperslop-systems/plot";

const TOKENS = fileURLToPath(new URL("../../../src/tokens.css", import.meta.url));
const BEGIN = "  /* ---- BEGIN GENERATED PALETTE ---- */";
const END = "  /* ---- END GENERATED PALETTE ---- */";

function block(): string {
  const lines = PALETTE.map((hex, i) => `  --pbui-cat-${i + 1}: ${hex};`);
  lines.push(`  --pbui-ramp-low: ${RAMP_LOW};`);
  lines.push(`  --pbui-ramp-high: ${RAMP_HIGH};`);
  return lines.join("\n");
}

const css = await readFile(TOKENS, "utf8");
const start = css.indexOf(BEGIN);
const end = css.indexOf(END);

if (start < 0 || end < 0) {
  console.error(`could not find the generated-palette markers in ${TOKENS}`);
  process.exit(1);
}

const next = `${css.slice(0, start + BEGIN.length)}\n${block()}\n${css.slice(end)}`;

if (next === css) {
  console.log("tokens.css palette already matches @hyperslop-systems/plot");
} else {
  await writeFile(TOKENS, next);
  console.log(`wrote ${PALETTE.length} categorical tokens + ramp to tokens.css`);
}
