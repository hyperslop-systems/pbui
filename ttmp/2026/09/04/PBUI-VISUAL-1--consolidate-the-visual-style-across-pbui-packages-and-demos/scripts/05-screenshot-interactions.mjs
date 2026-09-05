// PBUI-VISUAL-1: interaction-state screenshots — states a static per-story
// sweep cannot show because they only exist after a click/drag/keystroke.
//
//   node 05-screenshot-interactions.mjs [outDir]
//
// Runs anywhere in the pbui repo: playwright is resolved from
// packages/pbui-ecommerce, the one workspace package that depends on it.
// Assumes the five storybooks named in the ticket are already running
// (tmux session `pbui-visual`) — this script never starts or stops a server.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../.."); // ttmp/2026/09/04/TICKET/scripts -> repo root
const require = createRequire(path.join(repoRoot, "packages/pbui-ecommerce/package.json"));
const { chromium } = require("playwright");

const outRoot = process.argv[2] ?? path.join(here, "..", "various", "screenshots", "interactions");
const WIDTH = 1280;
const HEIGHT = 800;

const PORTS = {
  core: 6006,
  "pbui-chat": 6007,
  "pbui-sandbox": 6009,
  "pbui-editor": 6010,
  "pbui-plotscript": 6011,
};

const counters = {};
const manifests = {};

function urlFor(pkg, id) {
  return `http://localhost:${PORTS[pkg]}/iframe.html?id=${id}&viewMode=story`;
}

async function goto(page, pkg, id) {
  await page.goto(urlFor(pkg, id), { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector("#storybook-root > *", { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function shoot(page, pkg, story, slug, description, opts = {}) {
  counters[pkg] = (counters[pkg] ?? 0) + 1;
  const n = counters[pkg];
  const dir = path.join(outRoot, pkg);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${String(n).padStart(3, "0")}-${slug}.png`;
  const shotOpts = { path: path.join(dir, file) };
  if (opts.clip) shotOpts.clip = opts.clip;
  if (opts.fullPage) shotOpts.fullPage = true;
  await page.screenshot(shotOpts);
  const rec = { n, story, slug, description, file };
  (manifests[pkg] ??= []).push(rec);
  console.log(`[${pkg}] ${n} ${slug}`);
  return rec;
}

function writeManifests() {
  for (const [pkg, list] of Object.entries(manifests)) {
    const dir = path.join(outRoot, pkg);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(list, null, 2));
    console.log(`wrote ${list.length} entries to ${path.join(dir, "manifest.json")}`);
  }
}

async function run(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`FAILED: ${label}\n  ${err}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await context.newPage();

/* ------------------------------------------------------------------ */
/* core (6006)                                                        */
/* ------------------------------------------------------------------ */

await run("core: object menu open on a presentation", async () => {
  await goto(page, "core", "presentation-pbui-protocol--default");
  await page.getByText("Ada Lovelace", { exact: true }).click({ button: "right" });
  await page.waitForSelector('[data-pbui="menu"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "presentation-pbui-protocol--default", "object-menu-open", "Right-click on the 'Ada Lovelace' presentation opens the descriptor-provided object menu (role=menu) anchored at the pointer.");
});

await run("core: menu with a disabled entry and its reason", async () => {
  await goto(page, "core", "presentation-pbui-protocol--with-contextual-help");
  await page.getByText("You (email action unavailable)", { exact: true }).click({ button: "right" });
  await page.waitForSelector('[data-pbui="menu"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "presentation-pbui-protocol--with-contextual-help", "menu-disabled-entry-reason", "Right-click on 'You': the Send email menu item is disabled and shows its refusal reason inline via data-part=menu-reason.");
});

await run("core: accept mode banner with acceptable targets highlighted", async () => {
  await goto(page, "core", "presentation-interaction-kernel-4--accept-chooser-and-banner");
  await page.getByRole("button", { name: "pick a person…" }).click();
  await page.waitForSelector('[data-pbui="accept-banner"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "presentation-interaction-kernel-4--accept-chooser-and-banner", "accept-mode-banner", "After clicking 'pick a person…': the accept banner is shown and eligible presentations (Ada, and the note that can resolve to a person) carry data-state=acceptable styling.");

  await page.getByText("note n-7", { exact: true }).click();
  await page.waitForSelector('[data-pbui="accept-chooser"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "presentation-interaction-kernel-4--accept-chooser-and-banner", "accept-chooser-open", "Clicking the note (which fits the pending accept request two ways via relations) opens the accept chooser listing both candidate people under the still-pending banner.");
});

await run("core: explain panel developer disclosure", async () => {
  await goto(page, "core", "presentation-interaction-kernel-4--explain-the-menu");
  await page.getByRole("radio", { name: "developer" }).click();
  await page.waitForTimeout(200);
  await shoot(page, "core", "presentation-interaction-kernel-4--explain-the-menu", "explain-developer-disclosure", "Switching the explain panel from public to developer disclosure: every candidate action's trace and fate appear, not just the rows the real menu would show.");
});

await run("core: refusal notice from a stale menu row", async () => {
  await goto(page, "core", "presentation-interaction-kernel-4--stale-row-refusal");
  await page.getByText("Ada Lovelace", { exact: true }).click({ button: "right" });
  await page.waitForSelector('[data-pbui="menu"]', { timeout: 5000 });
  // Flip the lock via the window global directly (as the story's own doc
  // instructs) so the open menu is NOT clicked-away and closed.
  await page.evaluate(() => {
    window.__pbuiStoryLocked = true;
  });
  await page.getByRole("menuitem", { name: "Email" }).click();
  await page.waitForSelector('[data-pbui="refusal-notice"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "presentation-interaction-kernel-4--stale-row-refusal", "refusal-notice", "The row was resolved before the directory locked; clicking Email re-checks at click time and refuses, surfacing the RefusalNotice banner with its reason.");
});

await run("core: chrome tile drag/dock preview", async () => {
  await goto(page, "core", "chrome-kit--two-tiles-with-drag");
  const grip = page.locator('[data-part="tile-grip"]').first();
  const gripBox = await grip.boundingBox();
  const tiles = page.locator('[data-part="tile"]');
  const targetBox = await tiles.nth(1).boundingBox();
  if (gripBox && targetBox) {
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await page.waitForTimeout(200);
    await shoot(page, "core", "chrome-kit--two-tiles-with-drag", "tile-drag-dock-preview", "Mid-drag: grip pressed on tile A, pointer moved over tile B's centre — the centre drop-zone overlay (swap) is shown.");
    await page.mouse.up();
  }
});

await run("core: launcher shell filtered query", async () => {
  await goto(page, "core", "chrome-kit--launcher");
  await page.getByRole("combobox").fill("goals");
  await page.waitForTimeout(200);
  await shoot(page, "core", "chrome-kit--launcher", "launcher-filtered-query", "Typing 'goals' into the launcher's search combobox filters the OPEN VIEWS / NEW VIEW groups live.");
});

await run("core: FileBrowser row selected", async () => {
  await goto(page, "core", "component-library-organisms-filebrowser--with-presentation");
  await page.getByText("lakefile.lean", { exact: true }).click();
  await page.waitForTimeout(200);
  await shoot(page, "core", "component-library-organisms-filebrowser--with-presentation", "filebrowser-row-selected", "Left-clicking a file row selects it (aria-selected / selection styling) via the presentation-protocol seam.");
});

await run("core: FileBrowser row object menu", async () => {
  await goto(page, "core", "component-library-organisms-filebrowser--with-presentation");
  await page.getByText("lakefile.lean", { exact: true }).click({ button: "right" });
  await page.waitForSelector('[data-pbui="menu"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "component-library-organisms-filebrowser--with-presentation", "filebrowser-row-menu-open", "Right-clicking a file row opens its object menu: Rename…, Delete (family-derived rows).");
});

await run("core: InlineRename editing", async () => {
  await goto(page, "core", "component-library-molecules-inlinerename--live");
  await page.getByRole("button", { name: "explore" }).click();
  await page.waitForSelector("input", { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "core", "component-library-molecules-inlinerename--live", "inlinerename-editing", "Clicking the workspace name button swaps it for the InlineRename input, focused and pre-filled — the editing state.");
});

await run("core: FileDropZone drag-over", async () => {
  await goto(page, "core", "component-library-molecules-filedropzone--dragging");
  const zone = page.locator('[data-testid="drop-zone"]');
  await zone.dispatchEvent("dragover", { bubbles: true, cancelable: true });
  await page.waitForTimeout(200);
  await shoot(page, "core", "component-library-molecules-filedropzone--dragging", "filedropzone-drag-over", "A dragover event over the drop zone sets data-state=acceptable — firmer border plus the selection fill.");
});

/* ------------------------------------------------------------------ */
/* pbui-chat (6007)                                                   */
/* ------------------------------------------------------------------ */

// SKIPPED (not a screenshot bug): clicking "insert object…" on
// pbui-chat-composer--with-transcript crashes the whole story. Composer's
// insertObject() calls pbui.accept({ types: Object.keys(chat.vocabulary.types) }),
// and that vocabulary includes a runtime "message" type that PBUI-KERNEL-1's
// closed-world type graph does not declare — isAcceptable() throws
// `runtime type "message" is not declared in the type graph (PBUI-KERNEL-1 C9)`
// with no error boundary around the story, blanking #storybook-root. Confirmed
// via a standalone Playwright probe (console + pageerror listeners); every
// Composer story shares the same meta-level DemoChat decorator and vocabulary,
// so no existing or addable story sidesteps it without touching product
// source (out of scope here). Logged as a real bug in notes-interactions.md.
console.log("[pbui-chat] SKIPPED composer-accept-mode: insertObject() crashes on the undeclared runtime type \"message\" (PBUI-KERNEL-1 C9) — see notes-interactions.md");

await run("pbui-chat: PbuiWidget form accept mode", async () => {
  await goto(page, "pbui-chat", "pbui-chat-pbuiwidget--form");
  await page.getByRole("button", { name: /pick/ }).first().click();
  await page.waitForSelector('[data-pbui="accept-banner"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "pbui-chat", "pbui-chat-pbuiwidget--form", "widget-form-accept-mode", "The form's object field 'pick…' button enters accept mode for the <product> type — banner shown, acceptable presentations highlighted.");
});

await run("pbui-chat: PbuiWidget table row menu", async () => {
  await goto(page, "pbui-chat", "pbui-chat-pbuiwidget--streaming-table");
  // The row's presentation is its leftmost "#index" handle cell, not the
  // formatted data cells (those are plain text — see TableChild.tsx).
  const row = page.locator('[data-part="table"] tbody tr').first().locator('[data-pbui="presentation"]');
  await row.click({ button: "right" });
  await page.waitForSelector('[data-pbui="menu"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "pbui-chat", "pbui-chat-pbuiwidget--streaming-table", "widget-table-row-menu", "Right-clicking a streaming table's row (a <row> presentation) opens its object menu.");
});

await run("pbui-chat: PbuiWidget title menu", async () => {
  await goto(page, "pbui-chat", "pbui-chat-pbuiwidget--health");
  await page.getByTestId("widget-title-m2-w1").click({ button: "right" });
  await page.waitForSelector('[data-pbui="menu"]', { timeout: 5000 });
  await page.waitForTimeout(200);
  await shoot(page, "pbui-chat", "pbui-chat-pbuiwidget--health", "widget-title-menu", "Right-clicking the widget's own title presentation opens its menu (open in tile, inspect, ask the agent).");
});

await run("pbui-chat: ProposalCard decided live (danger carried through)", async () => {
  await goto(page, "pbui-chat", "pbui-chat-proposalcard--pending");
  await page.getByRole("button", { name: "Reject" }).click();
  await page.waitForTimeout(200);
  await shoot(page, "pbui-chat", "pbui-chat-proposalcard--pending", "proposalcard-rejected-live", "Rejecting live from Pending: unlike the static Rejected story (which sets danger:false in args), a real decision leaves the card's original danger styling in place — the two can disagree.");
});

/* ------------------------------------------------------------------ */
/* pbui-sandbox (6009) — new Visual Audit story                       */
/* ------------------------------------------------------------------ */

await run("pbui-sandbox: inspector with a running instance", async () => {
  await goto(page, "pbui-sandbox", "visual-audit-sandbox-devtools--all-devtools");
  await page.waitForSelector('[data-part="program-inspector"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  await shoot(page, "pbui-sandbox", "visual-audit-sandbox-devtools--all-devtools", "devtools-initial-content", "Script tile (Counter, running) beside inspector/timeline/REPL, all bound to the same host — the load/render entries and state pane are already populated.");

  // Drive the running program so timeline + REPL have real entries.
  const scriptApp = page.locator('[data-part="script-app"]');
  await scriptApp.getByRole("button", { name: "+" }).click();
  await scriptApp.getByRole("button", { name: "+" }).click();
  await page.waitForTimeout(200);

  const treeButton = page.getByRole("button", { name: "tree" });
  await treeButton.click().catch(() => {});
  await page.waitForTimeout(200);
  await shoot(page, "pbui-sandbox", "visual-audit-sandbox-devtools--all-devtools", "inspector-tree-pane", "Inspector's tree pane after two 'increment' clicks: the render outline with per-node fire buttons.");
});

await run("pbui-sandbox: REPL with evaluated output", async () => {
  const replInput = page.getByLabel("REPL input");
  await replInput.click();
  await replInput.fill("$state");
  await replInput.press("Enter");
  await page.waitForTimeout(300);
  await shoot(page, "pbui-sandbox", "visual-audit-sandbox-devtools--all-devtools", "repl-with-output", "Evaluating `$state` in the REPL: the result line renders the JSON value beneath the echoed input.");
});

await run("pbui-sandbox: timeline with entries", async () => {
  await page.waitForTimeout(200);
  await shoot(page, "pbui-sandbox", "visual-audit-sandbox-devtools--all-devtools", "timeline-with-entries", "Timeline after the increments and the REPL evaluate: render/intent/event/evaluate rows, newest first.");
});

/* ------------------------------------------------------------------ */
/* pbui-editor (6010)                                                 */
/* ------------------------------------------------------------------ */

await run("pbui-editor: CodeEditor focused with syntax highlighting", async () => {
  await goto(page, "pbui-editor", "editor-codeeditor--java-script");
  const editor = page.locator("textarea, [contenteditable='true']").first();
  await editor.click();
  await page.waitForTimeout(200);
  await shoot(page, "pbui-editor", "editor-codeeditor--java-script", "codeeditor-focused", "Clicking into the JavaScript CodeEditor shows the focus ring alongside its syntax-highlighted content.");
});

/* ------------------------------------------------------------------ */
/* pbui-plotscript (6011)                                             */
/* ------------------------------------------------------------------ */

await run("pbui-plotscript: live edit produces an error diagnostic", async () => {
  await goto(page, "pbui-plotscript", "plotscript-tiles--editor-beside-plot");
  const editor = page.locator("textarea, [contenteditable='true']").first();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("const rows = [{ v: 1 }];\nreturn rows.map(r => r.missing.x);", { delay: 5 });
  await page.waitForTimeout(500);
  await shoot(page, "pbui-plotscript", "plotscript-tiles--editor-beside-plot", "live-edit-error-diagnostic", "Typing a script that throws into the live script tile: the plot pane drops its last plot and shows the engine's error, without navigating to a dedicated 'throwing' story.");
});

await browser.close();
writeManifests();
console.log("done");
