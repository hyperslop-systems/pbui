#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const output = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(import.meta.dirname, "../reference/02-identity-semantics-inventory.json");

const excludedDirectories = new Set([
  ".git",
  ".artifacts",
  "coverage",
  "dist",
  "gen",
  "node_modules",
  "storybook-static",
  "ttmp",
]);
const sourceExtensions = /\.(?:ts|tsx|go|proto)$/;
const testFiles = /(?:\.test\.[tj]sx?|_test\.go)$/;

const categories = {
  semanticRevision: /semantic revision|snapshotRevision|revision\??:\s*(?:string\s*\|\s*number|\(facts\)|facts\.revision)/i,
  localRevision: /core revision|local revision|runtime revision|readonly revision:\s*number|revision = state\.revision \+ 1/i,
  serverRevision: /server revision|expectedRevision|If-Match|revision:\s*(?:string|bigint)|Revision\s*=\s*string/i,
  contentDigest: /content digest|inputDigest|digestCanonicalJson|crypto\.subtle\.digest|fingerprint/i,
  operationIdentity: /operation id|operationId|requestId|Idempotency-Key|requestIdOf|effectId/i,
  eventIdentity: /eventId|event_id|EventId/i,
  computationEpoch: /runId|run_id|\bticket\b|generation|epoch/i,
};

function walk(directory, outputFiles = []) {
  for (const entry of readdirSync(directory)) {
    if (excludedDirectories.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path, outputFiles);
    else if (sourceExtensions.test(path) && !testFiles.test(path)) outputFiles.push(path);
  }
  return outputFiles;
}

const evidence = Object.fromEntries(Object.keys(categories).map((category) => [category, []]));
for (const path of walk(root)) {
  const file = relative(root, path).replaceAll("\\", "/");
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((text, index) => {
    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(text)) evidence[category].push({ file, line: index + 1, text: text.trim() });
    }
  });
}

const result = {
  generatedBy: relative(root, new URL(import.meta.url).pathname),
  categories: Object.fromEntries(
    Object.entries(evidence).map(([category, rows]) => [
      category,
      {
        occurrences: rows.length,
        files: [...new Set(rows.map((row) => row.file))].length,
        evidence: rows,
      },
    ]),
  ),
};
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`wrote ${output}`);
for (const [category, details] of Object.entries(result.categories)) {
  console.log(`${category}: ${details.occurrences} occurrence(s) in ${details.files} file(s)`);
}
