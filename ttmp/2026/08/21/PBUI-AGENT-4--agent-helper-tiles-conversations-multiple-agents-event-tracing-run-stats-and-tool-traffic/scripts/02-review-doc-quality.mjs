#!/usr/bin/env node

/** Quality audit for the full PBUI-AGENT-4 review document set. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = process.cwd();
const ticket = "ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic";
const docs = [
  `${ticket}/design-doc/03-pbui-itself-core-presentation-system-components-chrome-accessibility-and-design-system-code-review.md`,
  `${ticket}/design-doc/04-pbui-javascript-api-and-interaction-workbench-protocol-verbs-state-and-integration-code-review.md`,
  `${ticket}/design-doc/05-agent-framework-and-tiles-multi-conversation-runtime-routing-tools-server-and-helper-tile-code-review.md`,
  `${ticket}/design-doc/06-tool-calls-and-agent-ui-interaction-frontend-tools-approval-gates-verb-routing-observability-and-code-review.md`,
];
const outputArg = process.argv.indexOf("--output");
const output = outputArg >= 0 ? process.argv[outputArg + 1] : null;

const required = [
  /## (?:1\. )?Executive summary/i,
  /## \d+\. (?:System model|The core mental model|Workbench vocabulary|Mental model)/i,
  /## \d+\. (?:Detailed findings|Ranked findings|API reference|Public API reference)/i,
  /## \d+\. (?:Design decisions|Decision records)/i,
  /## \d+\. (?:Testing|Testing and validation|Testing strategy)/i,
  /## \d+\. (?:Phased|Proposed target architecture|Proposed target design)/i,
  /## \d+\. (?:Evidence and references|References)/i,
];

const rows = [];
const issues = [];
for (const path of docs) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    issues.push(`${path}: missing`);
    continue;
  }
  const text = readFileSync(full, "utf8");
  const words = text.split(/\s+/).filter(Boolean).length;
  const fences = (text.match(/^```/gm) ?? []).length;
  const mermaid = (text.match(/^```mermaid$/gm) ?? []).length;
  const bullets = (text.match(/^\s*[-*] /gm) ?? []).length;
  const tables = (text.match(/^\|.*\|$/gm) ?? []).length;
  const findings = (text.match(/^### [A-Z]\d+ /gm) ?? []).length;
  const decisions = (text.match(/^### Decision(?: \d+)?:/gm) ?? []).length;
  const fileRefs = (text.match(/`(?:src|packages|pkg|proto)\//g) ?? []).length;

  if (fences % 2 !== 0) issues.push(`${path}: unbalanced code fences (${fences})`);
  if (mermaid < 2) issues.push(`${path}: expected at least two Mermaid diagrams, found ${mermaid}`);
  if (words < 3000) issues.push(`${path}: expected at least 3,000 words, found ${words}`);
  if (findings < 6) issues.push(`${path}: expected at least six ranked findings, found ${findings}`);
  if (decisions < 3) issues.push(`${path}: expected at least three decision records, found ${decisions}`);
  if (fileRefs < 8) issues.push(`${path}: expected at least eight concrete file references, found ${fileRefs}`);
  if (/<!--|\bTODO\b|\bTBD\b|\bFIXME\b/.test(text)) issues.push(`${path}: contains placeholder/comment marker`);
  for (const pattern of required) {
    if (!pattern.test(text)) issues.push(`${path}: missing required section matching ${pattern}`);
  }

  const repoPaths = [...text.matchAll(/^\s*- Path: repo:\/\/(.+)$/gm)].map((match) => match[1].trim());
  for (const repoPath of repoPaths) {
    if (!existsSync(resolve(root, repoPath))) issues.push(`${path}: RelatedFiles target does not exist: ${repoPath}`);
  }

  rows.push({ path, words, lines: text.split(/\r?\n/).length, fences, mermaid, bullets, tables, findings, decisions, fileRefs });
}

const report = [
  "---",
  "Title: 'PBUI review document quality audit'",
  "Ticket: PBUI-AGENT-4",
  "Status: active",
  "Topics: [pbui, chat, frontend, backend, onboarding]",
  "DocType: reference",
  "Intent: long-term",
  "Owners: []",
  "RelatedFiles: []",
  "ExternalSources: []",
  "Summary: 'Automated structural and content-quality audit for the full PBUI-AGENT-4 review document set.'",
  "WhatFor: Prove each review document meets its required structure and evidence density.",
  "WhenToUse: Before committing or uploading the review bundle.",
  "---",
  "",
  "# PBUI review document quality audit",
  "",
  `Result: **${issues.length === 0 ? "PASS" : "FAIL"}**`,
  "",
  "| Document | Lines | Words | Mermaid | Findings | Decisions | File refs |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...rows.map((row) => `| \`${basename(row.path)}\` | ${row.lines} | ${row.words} | ${row.mermaid} | ${row.findings} | ${row.decisions} | ${row.fileRefs} |`),
  "",
  "## Issues",
  "",
  ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- None."]),
  "",
  "## Audit rules",
  "",
  "- Balanced fenced code blocks.",
  "- At least 3,000 words, two Mermaid diagrams, six ranked findings, three decision records and eight concrete source references per document.",
  "- Required architecture/findings/testing/roadmap/reference sections.",
  "- No TODO/TBD/FIXME or generated-template comments.",
  "- Every frontmatter `repo://` RelatedFiles target exists.",
  "",
].join("\n");

if (output) writeFileSync(resolve(root, output), report);
else process.stdout.write(report);
if (issues.length) process.exit(1);
