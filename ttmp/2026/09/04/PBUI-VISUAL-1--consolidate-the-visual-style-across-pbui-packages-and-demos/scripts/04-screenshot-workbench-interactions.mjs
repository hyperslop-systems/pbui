// Interactive-state screenshots for the WORKBENCH + TILE-LINKING visual
// audit (PBUI-VISUAL-1): states only reachable by real pointer/keyboard
// interaction — menus, connect-mode drags, pin/hold, ambiguity, the
// rebalance dialog — driven against the running Storybook instances the
// same way packages/pbui-ecommerce/e2e/scenes.mjs drives them (native
// Playwright against the story iframe, one scenario at a time).
//
//   node 04-screenshot-workbench-interactions.mjs [outDir]
//
// Reads from:
//   pbui-ecommerce storybook  http://localhost:6012  (Shop/Scenes stories)
//   pbui-workbench storybook  http://localhost:6008  (Workbench/RebalanceLab)
// Writes <outDir>/NNN-<slug>.png plus manifest.json ({n, story, slug,
// description, file}). Viewport 1440x900. Does not touch source or CSS,
// does not start/stop any server.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../.."); // ttmp/2026/09/04/TICKET/scripts -> repo root
const require = createRequire(path.join(repoRoot, "packages/pbui-ecommerce/package.json"));
const { chromium } = require("playwright");

const outDir = process.argv[2] ?? path.join(here, "..", "various", "screenshots", "workbench-interactions");
fs.mkdirSync(outDir, { recursive: true });

const ECOM = process.env.ECOM ?? "http://localhost:6012";
const WORKBENCH = process.env.WORKBENCH ?? "http://localhost:6008";
const ecomStory = (id) => `${ECOM.replace(/\/$/, "")}/iframe.html?id=${id}&viewMode=story`;
const wbStory = (id) => `${WORKBENCH.replace(/\/$/, "")}/iframe.html?id=${id}&viewMode=story`;

const shots = [];
const shot = (story, slug, description, run) => shots.push({ story, slug, description, run });

// --- 1. right-click menu open on a presentation -----------------------------
shot("shop-scenes--scene-1-ambient", "right-click-menu-open", "right-click an order row: the object menu opens, offering “Link to order detail · order” among other rows", async (page) => {
  await page.goto(ecomStory("shop-scenes--scene-1-ambient"));
  await page.waitForSelector('[data-part="orders-table"]');
  await page.locator('tr[data-order-id="88152"] [data-ptype="order"]').click({ button: "right" });
  await page.waitForSelector('[role="menuitem"]');
  await page.waitForTimeout(150);
});

// --- 2. accept mode: connect-mode drag, acceptable target highlighted ------
shot("shop-scenes--scene-1-ambient", "connect-mode-acceptable-highlighted", "Mod+Shift+L then drag ▸ order toward ◂ order mid-flight: the wire-cursor names Follow(...) and the acceptable input lights up before release", async (page) => {
  await page.goto(ecomStory("shop-scenes--scene-1-ambient"));
  await page.waitForSelector('[data-part="orders-table"]');
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+Shift+L");
  await page.waitForSelector('[data-part="port-rail"]');
  const from = page.locator('[data-part="port-rail-port"][data-side="out"][data-port-id$="/order"]').first();
  const to = page.locator('[data-part="port-rail-port"][data-side="in"][data-port-id$="/order"]').first();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 });
  await page.waitForSelector('[data-part="wire-cursor"]');
  await page.waitForTimeout(150);
  // the screenshot is taken by the driver loop right here, mid-drag, before mouseup
});

// --- 3. accept mode: incompatible target refused, named -------------------
shot("shop-scenes--scene-5-incompatible", "connect-mode-refused-target", "Ctrl-drag onto an incompatible port: the wire-cursor says “cannot share with …” and the target is data-acceptable=false", async (page) => {
  await page.goto(ecomStory("shop-scenes--scene-5-incompatible"));
  await page.waitForSelector('[data-part="port-rail"]');
  const from = page.locator('[data-part="port-rail-port"][data-side="out"][data-port-id$="/selection"]').first();
  const to = page.locator('[data-part="port-rail-port"][data-side="in"][data-port-id$="/selection"]').last();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.keyboard.down("Control");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.waitForSelector('[data-part="wire-cursor"]');
  await page.waitForTimeout(150);
});

// --- 4. a completed link: wires + badges visible ----------------------------
shot("shop-scenes--scene-7-connect-mode", "completed-link-wires-and-badges", "connect mode over an already-linked pair: the wire is drawn and the badges at both ends show their state", async (page) => {
  await page.goto(ecomStory("shop-scenes--scene-7-connect-mode"));
  await page.waitForSelector('[data-part="wire"]');
  await page.waitForTimeout(300);
});

// --- 5. a paused / pinned link -----------------------------------------------
shot("shop-scenes--scene-2-hold", "paused-pinned-link", "the detail is pinned (held) on order #88213; the badge reads ⏸ and the row selection no longer moves it", async (page) => {
  await page.goto(ecomStory("shop-scenes--scene-2-hold"));
  await page.waitForSelector('[data-part="port-badge"][data-state="held"]');
  await page.waitForTimeout(200);
});

// --- 6. an ambiguity: two equally-good "Link to …" targets -----------------
shot("shop-scenes--scene-3-show", "ambiguity-menu-two-targets", "right-click an order with two open detail tiles: the object menu lists “Link to detail A · order” and “Link to detail B · order” — the user disambiguates by picking a row", async (page) => {
  await page.goto(ecomStory("shop-scenes--scene-3-show"));
  await page.waitForSelector('[data-part="orders-table"]');
  await page.locator('tr[data-order-id="88152"] [data-ptype="order"]').click({ button: "right" });
  await page.waitForSelector('[role="menuitem"]');
  await page.waitForTimeout(150);
});

// --- 7. the rebalance dialog, with proposals --------------------------------
shot("workbench-rebalancelab--lab", "rebalance-dialog-proposals", "RebalanceLab: SLIVER preset (one tile hogs 90%), REBALANCE pressed — the dialog's proposal cards", async (page) => {
  await page.goto(wbStory("workbench-rebalancelab--lab"));
  await page.waitForSelector("text=SLIVER");
  await page.getByRole("button", { name: "SLIVER" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /REBALANCE/ }).click();
  await page.waitForTimeout(300);
});

// -----------------------------------------------------------------------------

const browser = await chromium.launch();
const manifest = [];
const pad = (n) => String(n).padStart(3, "0");
let n = 0;
for (const { story, slug, description, run } of shots) {
  n += 1;
  const file = `${pad(n)}-${slug}.png`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const rec = { n, story, slug, description, file };
  try {
    await run(page);
    await page.screenshot({ path: path.join(outDir, file) });
    console.log(`  ok   ${n} ${slug}`);
  } catch (error) {
    rec.error = error instanceof Error ? error.message : String(error);
    console.log(`  FAIL ${n} ${slug}\n       ${rec.error}`);
    await page.screenshot({ path: path.join(outDir, file) }).catch(() => undefined);
  } finally {
    await context.close();
  }
  manifest.push(rec);
}
await browser.close();
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nwrote ${manifest.length} screenshots + manifest.json to ${outDir}`);
