// Screenshot series across the four running demo apps (datalab-ui,
// pbui-chat, pbui-plotscript, pbui-ecommerce) for the PBUI-VISUAL-1 audit.
//
//   node 03-screenshot-demos.mjs [--only=datalab,pbui-chat,plotscript,ecommerce]
//
// Writes $T/various/screenshots/demos/<demo>/NNN-<slug>.png plus a
// manifest.json per demo. Runs anywhere in the pbui repo: playwright is
// resolved from packages/pbui-ecommerce, the one workspace package that
// depends on it.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../.."); // ttmp/2026/09/04/TICKET/scripts -> repo root
const require = createRequire(path.join(repoRoot, "packages/pbui-ecommerce/package.json"));
const { chromium } = require("playwright");

const OUT_ROOT = process.env.OUT_ROOT ?? path.resolve(here, "../various/screenshots/demos");
const VIEWPORT = { width: 1440, height: 900 };

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;

class Shooter {
  constructor(demo) {
    this.demo = demo;
    this.dir = path.join(OUT_ROOT, demo);
    fs.mkdirSync(this.dir, { recursive: true });
    this.n = 0;
    this.manifest = [];
  }
  async shot(page, slug, description) {
    this.n += 1;
    const file = `${String(this.n).padStart(3, "0")}-${slug}.png`;
    const rec = { n: this.n, demo: this.demo, slug, description, file };
    try {
      await page.screenshot({ path: path.join(this.dir, file), fullPage: false });
    } catch (ex) {
      rec.error = String(ex).slice(0, 300);
    }
    this.manifest.push(rec);
    console.log(`[${this.demo}] ${String(this.n).padStart(3, "0")} ${slug}${rec.error ? " ERROR " + rec.error : ""}`);
  }
  write() {
    fs.writeFileSync(path.join(this.dir, "manifest.json"), JSON.stringify(this.manifest, null, 2));
    console.log(`wrote ${this.manifest.length} entries to ${path.join(this.dir, "manifest.json")}`);
  }
}

async function safe(fn, label) {
  try {
    await fn();
    return true;
  } catch (ex) {
    console.log(`  ! ${label}: ${String(ex).slice(0, 200)}`);
    return false;
  }
}

/** Like `safe`, but returns the wrapped function's actual value (undefined on error). */
async function tryValue(fn, label) {
  try {
    return await fn();
  } catch (ex) {
    console.log(`  ! ${label}: ${String(ex).slice(0, 200)}`);
    return undefined;
  }
}

async function rightClick(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ button: "right", force: true, timeout: 5000 });
  await page.waitForTimeout(300);
}

async function pressKeys(page, keys) {
  await page.keyboard.press(keys);
  await page.waitForTimeout(300);
}

async function closeMenus(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(150);
}

/** Click the first object-menu item whose visible text matches `re` (default: "Link to …", not "linked duplicate"). */
async function clickMenuItemMatching(page, re = /\blink to\b/i) {
  const items = page.locator('[data-part="menu-item"]');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const text = (await items.nth(i).innerText().catch(() => "")) ?? "";
    if (re.test(text)) {
      await items.nth(i).click({ timeout: 5000 });
      await page.waitForTimeout(300);
      return true;
    }
  }
  return false;
}

const WORKSPACE_STRIP_ITEMS = '[data-part="workspace-strip"] > button, [data-part="workspace-strip-item"]';

// ---------------------------------------------------------------- datalab --

async function runDatalab(browser) {
  const demo = "datalab-ui";
  if (only && !only.has("datalab")) return;
  const s = new Shooter(demo);
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await safe(async () => {
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(500);
  }, "goto marketing");
  await s.shot(page, "marketing-hero", "Marketing landing page, hero section with live WorkbenchInstance");

  await safe(async () => {
    const nav = page.locator("nav[aria-label='Primary'] button").first();
    await nav.hover({ timeout: 3000 });
    await page.waitForTimeout(200);
  }, "hover nav item");
  await s.shot(page, "marketing-nav-hover", "Hover state on a marketing nav button");

  await safe(async () => {
    await page.evaluate(() => document.getElementById("tutorial")?.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);
  }, "scroll to tutorial");
  await s.shot(page, "marketing-tutorial-band", "Marketing page scrolled to the tutorial band");

  await safe(async () => {
    await page.goto("http://localhost:5173/ui/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(600);
  }, "goto workbench");
  await s.shot(page, "workbench-initial", "Datalab workbench, initial stage/workspace");

  // Right-click a tile title presentation to open the object menu.
  const tilePresentation = page.locator('[data-part="workbench-tile"] [data-pbui="presentation"]').first();
  const hasTile = (await tilePresentation.count()) > 0;
  if (hasTile) {
    const opened = await safe(() => rightClick(page, tilePresentation), "right-click tile");
    if (opened) await s.shot(page, "tile-object-menu", "Object menu open on a tile title presentation");

    const linked = await tryValue(() => clickMenuItemMatching(page), "click Link to… menu item");
    if (linked) {
      await page.waitForTimeout(300);
      await s.shot(page, "accept-mode", "Accept/link mode in progress — acceptable presentations highlighted");
    }
    await closeMenus(page);
  } else {
    console.log("  ! no [data-part=workbench-tile] presentation found on workbench");
  }

  // A doc chip (α/β/γ) is a `<doc>` presentation with its own "Link to…"
  // family independent of the tile bar's — try one directly.
  const docChip = page.locator('[data-pbui="presentation"][data-ptype="doc"]').first();
  if ((await docChip.count()) > 0) {
    const opened = await safe(() => rightClick(page, docChip), "right-click doc chip");
    if (opened) await s.shot(page, "doc-chip-object-menu", "Object menu open on a <doc> chip (α/β/γ)");
    const linked2 = await tryValue(() => clickMenuItemMatching(page), "click Link to… on doc chip");
    if (linked2) {
      await page.waitForTimeout(300);
      await s.shot(page, "doc-chip-accept-mode", "Accept mode after choosing Link to… on a doc chip");
    }
    await closeMenus(page);
  }

  // Launcher (Mod+K).
  await safe(() => pressKeys(page, "Control+k"), "open launcher");
  await s.shot(page, "launcher-open", "Launcher dialog (Mod+K)");
  await safe(async () => {
    await page.keyboard.type("chart");
    await page.waitForTimeout(300);
  }, "type in launcher");
  await s.shot(page, "launcher-filtered", "Launcher filtered by query");
  await closeMenus(page);

  // Workspace strip items (the pinned "build / explore / gallery / help" row).
  const wsItems = page.locator(WORKSPACE_STRIP_ITEMS);
  const wsCount = await wsItems.count();
  if (wsCount > 1) {
    await safe(() => wsItems.nth(1).hover({ timeout: 3000 }), "hover 2nd workspace");
    await s.shot(page, "workspace-strip-hover", "Hover state on a workspace-strip button");
    await safe(() => wsItems.nth(1).click({ timeout: 3000 }), "click 2nd workspace");
    await page.waitForTimeout(400);
    await s.shot(page, "workspace-2", "Second workspace in the workspace strip");
  }

  // Stage bar select, if present.
  const stageSelect = page.locator("select").first();
  if ((await stageSelect.count()) > 0) {
    await safe(() => stageSelect.hover({ timeout: 3000 }), "hover stage select");
    await s.shot(page, "stage-bar", "Stage switcher select in the masthead");
  }

  // Hover over a tile/port badge chip.
  const badge = page.locator('[data-part="port-badge"], [data-part="tile-linked"]').first();
  if ((await badge.count()) > 0) {
    await safe(() => badge.hover({ timeout: 3000 }), "hover badge");
    await page.waitForTimeout(200);
    await s.shot(page, "badge-hover", "Hover state on a port/link badge chip");
  }

  await context.close();
  s.write();
}

// --------------------------------------------------------------- pbui-chat --

async function runPbuiChat(browser) {
  const demo = "pbui-chat";
  if (only && !only.has("pbui-chat")) return;
  const s = new Shooter(demo);
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await safe(async () => {
    await page.goto("http://localhost:5174/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
  }, "goto shop");
  await s.shot(page, "shop-initial", "Gold Coin Shop initial workbench layout");

  // Toggle "approver role" checkbox.
  await safe(async () => {
    await page.getByText("approver role", { exact: false }).click({ timeout: 3000 });
    await page.waitForTimeout(200);
  }, "toggle approver role");
  await s.shot(page, "approver-role-on", "Approver role checkbox toggled on");

  // Right-click a tile title.
  const tilePresentation = page.locator('[data-part="workbench-tile"] [data-pbui="presentation"]').first();
  if ((await tilePresentation.count()) > 0) {
    const opened = await safe(() => rightClick(page, tilePresentation), "right-click tile");
    if (opened) await s.shot(page, "tile-object-menu", "Object menu open on a tile title");

    const linked = await tryValue(() => clickMenuItemMatching(page), "click Link to…");
    if (linked) await s.shot(page, "accept-mode", "Accept/link mode with acceptable tiles highlighted");
    await closeMenus(page);
  }

  // Try a second tile (INSPECTOR) for a Link to… family too, since the
  // conversation tile's menu is doc-bound "Ask the agent…" verbs only.
  const secondTileBar = page.locator('[data-part="workbench-tile"] [data-pbui="presentation"]').nth(1);
  if ((await secondTileBar.count()) > 0) {
    const opened2 = await safe(() => rightClick(page, secondTileBar), "right-click 2nd tile");
    if (opened2) {
      const linked2 = await tryValue(() => clickMenuItemMatching(page), "click Link to… on 2nd tile");
      if (linked2) await s.shot(page, "accept-mode", "Accept/link mode with acceptable tiles highlighted");
      else await s.shot(page, "second-tile-object-menu", "Object menu on a second tile (no Link to… family here either)");
    }
    await closeMenus(page);
  }

  // Launcher.
  await safe(() => pressKeys(page, "Control+k"), "open launcher via button");
  await s.shot(page, "launcher-open", "Launcher dialog (⌘K/Ctrl+K)");
  await closeMenus(page);
  // Fall back to the explicit launcher button if the shortcut did not fire.
  await safe(async () => {
    const btn = page.getByTitle(/open the launcher/i);
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 3000 });
      await page.waitForTimeout(300);
    }
  }, "click launcher button");
  await s.shot(page, "launcher-via-button", "Launcher opened via the toolbar button");
  await closeMenus(page);

  // New conversation button.
  await safe(async () => {
    await page.getByTitle(/start another agent/i).click({ timeout: 3000 });
    await page.waitForTimeout(500);
  }, "new conversation");
  await s.shot(page, "new-conversation", "A second conversation tile opened via + conversation");

  // Rebalance — click a tile bar first so the shortcut has workbench focus
  // rather than the chat textarea.
  await safe(async () => {
    const bar = page.locator('[data-part="tile-bar"]').first();
    await bar.click({ timeout: 3000 });
  }, "focus a tile bar");
  await safe(() => pressKeys(page, "Control+Shift+k"), "open rebalance");
  await s.shot(page, "rebalance-dialog", "Rebalance layout-repair dialog (Mod+Shift+K)");
  await closeMenus(page);

  // Workspace strip.
  const wsItems = page.locator(WORKSPACE_STRIP_ITEMS);
  if ((await wsItems.count()) > 0) {
    await safe(() => wsItems.first().hover({ timeout: 3000 }), "hover workspace item");
    await s.shot(page, "workspace-strip-hover", "Hover state on a workspace strip item");
  }

  await context.close();
  s.write();
}

// -------------------------------------------------------------- plotscript --

async function runPlotscript(browser) {
  const demo = "pbui-plotscript";
  if (only && !only.has("plotscript")) return;
  const s = new Shooter(demo);
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await safe(async () => {
    await page.goto("http://localhost:5175/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
  }, "goto plotscript");
  await s.shot(page, "workspace-initial", "Scripted plots demo, first example workspace (script + plot split)");

  // NOTE: pbui-plotscript's own components render no `[data-pbui="presentation"]`
  // anywhere (script/plot tiles are plain divs) — this demo does not
  // participate in the object-menu/accept-mode system the other three do, so
  // there is no tile-object-menu / accept-mode shot for it (see notes-demos.md).

  // Hover + switch workspace via strip (each example is a workspace).
  const wsItems = page.locator(WORKSPACE_STRIP_ITEMS);
  const wsCount = await wsItems.count();
  if (wsCount > 0) {
    await safe(() => wsItems.first().hover({ timeout: 3000 }), "hover 1st workspace");
    await s.shot(page, "workspace-strip-hover", "Hover state on a workspace-strip button");
  }
  if (wsCount > 1) {
    await safe(() => wsItems.nth(1).click({ timeout: 3000 }), "click 2nd workspace");
    await page.waitForTimeout(500);
    await s.shot(page, "workspace-2", "Second example workspace (dodged bars)");
  }
  if (wsCount > 2) {
    await safe(() => wsItems.nth(2).click({ timeout: 3000 }), "click 3rd workspace");
    await page.waitForTimeout(500);
    await s.shot(page, "workspace-3", "Third example workspace (trend over a window)");
  }

  // The workbench shortcuts need focus inside the tile surface, not the
  // workspace-strip button clicked above, and not inside the CodeMirror
  // editor (which swallows Ctrl+K itself) — click a tile BAR instead.
  await safe(async () => {
    const bar = page.locator('[data-part="tile-bar"]').first();
    await bar.click({ timeout: 3000 });
    await page.waitForTimeout(150);
  }, "focus workbench surface via tile bar");

  // Launcher.
  await safe(() => pressKeys(page, "Control+k"), "open launcher");
  await s.shot(page, "launcher-open", "Launcher dialog (Mod+K)");
  await closeMenus(page);

  // Rebalance.
  await safe(() => pressKeys(page, "Control+Shift+k"), "open rebalance");
  await s.shot(page, "rebalance-dialog", "Rebalance layout-repair dialog (Mod+Shift+K)");
  await closeMenus(page);

  // Focus the script editor / run a script (Mod+Enter) to see runner state.
  await safe(async () => {
    const editor = page.locator('[data-part="workbench-tile"]').first();
    await editor.click({ timeout: 3000 });
    await page.waitForTimeout(150);
  }, "focus script tile");
  await safe(() => pressKeys(page, "Control+Enter"), "run script");
  await page.waitForTimeout(500);
  await s.shot(page, "script-run", "After running the focused script (Mod+Enter)");

  // Hover a tile-action button (split / show-something-else) in a tile bar.
  const tileAction = page.locator('[data-part="tile-actions"] button').first();
  if ((await tileAction.count()) > 0) {
    await safe(() => tileAction.hover({ timeout: 3000 }), "hover tile action");
    await page.waitForTimeout(150);
    await s.shot(page, "tile-action-hover", "Hover state on a tile-bar action button");
  }

  // Hover the split divider between the script and plot tiles.
  const divider = page.locator('[data-part="split-divider"]').first();
  if ((await divider.count()) > 0) {
    await safe(() => divider.hover({ timeout: 3000 }), "hover split divider");
    await page.waitForTimeout(150);
    await s.shot(page, "split-divider-hover", "Hover state on the split divider between tiles");
  }

  await context.close();
  s.write();
}

// -------------------------------------------------------------- ecommerce --

async function runEcommerce(browser) {
  const demo = "pbui-ecommerce";
  if (only && !only.has("ecommerce")) return;
  const s = new Shooter(demo);
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await safe(async () => {
    await page.goto("http://localhost:5176/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
  }, "goto shop");
  await s.shot(page, "shop-initial", "Gold coin shop e-commerce demo, initial workbench layout");

  // Right-click a tile title, then try Link to...
  const tilePresentation = page.locator('[data-part="workbench-tile"] [data-pbui="presentation"]').first();
  if ((await tilePresentation.count()) > 0) {
    const opened = await safe(() => rightClick(page, tilePresentation), "right-click tile");
    if (opened) await s.shot(page, "tile-object-menu", "Object menu open on a tile title");
    await closeMenus(page);
  }

  // Right-click a row/cell presentation inside a tile body (e.g. product row) for a richer menu.
  const bodyPresentation = page.locator('[data-part="workbench"] [data-pbui="presentation"]').nth(1);
  if ((await bodyPresentation.count()) > 0) {
    const opened = await safe(() => rightClick(page, bodyPresentation), "right-click body presentation");
    if (opened) await s.shot(page, "row-object-menu", "Object menu open on a row/item presentation inside a tile");

    const linked = await tryValue(() => clickMenuItemMatching(page), "click Link to…");
    if (linked) {
      await page.waitForTimeout(300);
      await s.shot(page, "accept-mode", "Accept/link mode — acceptable tiles/rows highlighted after choosing Link to…");
    }
    await closeMenus(page);
  }

  // Launcher.
  await safe(() => pressKeys(page, "Control+k"), "open launcher");
  await s.shot(page, "launcher-open", "Launcher dialog (Mod+K)");
  await closeMenus(page);

  // Wiring view (Mod+Shift+L).
  await safe(() => pressKeys(page, "Control+Shift+l"), "open wiring view");
  await s.shot(page, "wiring-view", "Link wiring overlay (Mod+Shift+L)");
  await closeMenus(page);

  // Hover a port badge chip.
  const badge = page.locator('[data-part="port-badge"], [data-part="tile-linked"]').first();
  if ((await badge.count()) > 0) {
    await safe(() => badge.hover({ timeout: 3000 }), "hover badge");
    await page.waitForTimeout(200);
    await s.shot(page, "badge-hover", "Hover state on a port badge chip");
  }

  // Workspace strip (orders / customers / sales / catalog).
  const wsItems = page.locator(WORKSPACE_STRIP_ITEMS);
  const wsCount = await wsItems.count();
  if (wsCount > 0) {
    await safe(() => wsItems.first().hover({ timeout: 3000 }), "hover workspace item");
    await s.shot(page, "workspace-strip-hover", "Hover state on a workspace strip item");
  }
  if (wsCount > 1) {
    await safe(() => wsItems.nth(1).click({ timeout: 3000 }), "click 2nd workspace");
    await page.waitForTimeout(500);
    await s.shot(page, "workspace-2", "Second workspace (customers)");
  }

  await context.close();
  s.write();
}

// ----------------------------------------------------------------- main ----

const browser = await chromium.launch();
await runDatalab(browser);
await runPbuiChat(browser);
await runPlotscript(browser);
await runEcommerce(browser);
await browser.close();
console.log("done");
