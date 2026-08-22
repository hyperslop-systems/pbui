#!/usr/bin/env node

/** Extract and render every Mermaid block in the three review docs. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const ticket = "ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic";
const docs = [
  `${ticket}/design-doc/03-pbui-itself-core-presentation-system-components-chrome-accessibility-and-design-system-code-review.md`,
  `${ticket}/design-doc/04-pbui-javascript-api-and-interaction-workbench-protocol-verbs-state-and-integration-code-review.md`,
  `${ticket}/design-doc/05-agent-framework-and-tiles-multi-conversation-runtime-routing-tools-server-and-helper-tile-code-review.md`,
];
const dir = mkdtempSync(join(tmpdir(), "pbui-mermaid-"));
const puppeteerConfig = join(dir, "puppeteer.json");
writeFileSync(puppeteerConfig, JSON.stringify({ args: ["--no-sandbox"] }));
let count = 0;
let failures = 0;

try {
  for (const doc of docs) {
    const text = readFileSync(resolve(root, doc), "utf8");
    const blocks = [...text.matchAll(/^```mermaid\s*\n([\s\S]*?)^```\s*$/gm)];
    for (const [index, match] of blocks.entries()) {
      count += 1;
      const input = join(dir, `${basename(doc, ".md")}-${index + 1}.mmd`);
      const output = `${input}.svg`;
      writeFileSync(input, match[1]);
      const result = spawnSync(
        "mmdc",
        ["-i", input, "-o", output, "--quiet", "--puppeteerConfigFile", puppeteerConfig],
        { encoding: "utf8" },
      );
      const label = `${basename(doc)} block ${index + 1}`;
      if (result.error?.code === "ENOENT") {
        failures += 1;
        console.error("FAIL: mmdc is not on PATH");
        break;
      }
      if (result.status !== 0) {
        failures += 1;
        console.error(`FAIL: ${label}\n${result.stdout}${result.stderr}`);
      } else {
        console.log(`PASS: ${label}`);
      }
    }
  }

  console.log(`Mermaid blocks: ${count}; failures: ${failures}`);
  if (failures) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
