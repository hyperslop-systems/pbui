// Real-interaction scenarios for the gold-coin shop (PBUI-LINK-1 design
// §12.4, audit §13): native pointer and keyboard against the Storybook
// stories, a fresh page per scenario, and a VISIBLE postcondition asserted
// for each — badge text, tile content, tile count — never a store field.
//
//   pnpm storybook            # port 6012, in another terminal
//   pnpm e2e                  # this file; STORYBOOK=http://host:port to override
//
// Plain `playwright` (the library) rather than `@playwright/test`, which the
// workspace does not carry; the runner below is forty lines.

import { chromium } from "playwright";

const BASE = process.env.STORYBOOK ?? "http://localhost:6012";
const story = (id) => `${BASE}/iframe.html?id=${id}&viewMode=story`;

const scenarios = [];
const scenario = (name, run) => scenarios.push({ name, run });

const badge = async (page, viewSuffix = "/order") => {
  const el = page.locator(`[data-part="port-badge"][data-port$="${viewSuffix}"]`).first();
  return `${await el.getAttribute("data-state")}:${(await el.textContent())?.trim()}`;
};
const detailTitle = (page) => page.locator('[data-part="order-detail"]').first().textContent();

scenario("right-click an order → Link to order detail: badge → orders, detail shows the order", async (page) => {
  await page.goto(story("shop-scenes--scene-1-ambient"));
  await page.waitForSelector('[data-part="orders-table"]');
  await page.locator('tr[data-order-id="88152"] [data-ptype="order"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Link to order detail · order/ }).click();
  await page.waitForFunction(() => document.querySelector('[data-part="port-badge"][data-state="following"]'));
  if ((await badge(page)) !== "following:→orders") throw new Error(`badge was ${await badge(page)}`);
  if (!(await detailTitle(page))?.includes("order #88152")) throw new Error("detail does not show #88152");
});

scenario("Shift-click Link to … then the badge: Pin holds; clicking another row does not move the detail; Resume catches up", async (page) => {
  await page.goto(story("shop-scenes--scene-2-follow"));
  await page.waitForSelector('[data-part="port-badge"][data-state="following"]');
  await page.locator('[data-ptype="port"]:has([data-port$="/order"])').click();
  await page.getByRole("menuitem", { name: /^Pin/ }).click();
  await page.waitForSelector('[data-part="port-badge"][data-state="held"]');
  await page.locator('tr[data-order-id="88160"]').click();
  if (!(await detailTitle(page))?.includes("order #88214")) throw new Error("held detail moved");
  await page.locator('[data-ptype="port"]:has([data-port$="/order"])').click();
  await page.getByRole("menuitem", { name: /^Resume/ }).click();
  await page.waitForSelector('[data-part="port-badge"][data-state="following"]');
  if (!(await detailTitle(page))?.includes("order #88160")) throw new Error("resume did not catch up");
});

scenario("Mod+Shift+L → drag ▸ order onto ◂ subject: wire drawn, badge changes; Escape leaves the mode and the app is clickable again", async (page) => {
  await page.goto(story("shop-scenes--scene-1-ambient"));
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
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  if (!(await page.locator('[data-part="wire-cursor"]').textContent())?.startsWith("Follow(")) throw new Error("cursor badge does not name Follow");
  await page.mouse.up();
  await page.waitForSelector('[data-part="wire"][data-term="follow"]');
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-part="port-rail"]', { state: "detached" });
  if ((await badge(page)) !== "following:→orders") throw new Error(`badge was ${await badge(page)}`);
  await page.locator('tr[data-order-id="88153"]').click();
  if (!(await detailTitle(page))?.includes("order #88153")) throw new Error("app not interactive after Escape");
});

scenario("Shift released mid-drag: the cursor badge switches from Hold to Follow before release", async (page) => {
  await page.goto(story("shop-scenes--scene-1-ambient"));
  await page.waitForSelector('[data-part="orders-table"]');
  await page.locator('tr[data-order-id="88154"]').click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+Shift+L");
  await page.waitForSelector('[data-part="port-rail"]');
  const from = page.locator('[data-part="port-rail-port"][data-side="out"][data-port-id$="/order"]').first();
  const to = page.locator('[data-part="port-rail-port"][data-side="in"][data-port-id$="/order"]').first();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  if (!(await page.locator('[data-part="wire-cursor"]').textContent())?.startsWith("Hold(")) throw new Error("Shift not read live");
  await page.keyboard.up("Shift");
  await page.mouse.move(b.x + b.width / 2 + 1, b.y + b.height / 2);
  if (!(await page.locator('[data-part="wire-cursor"]').textContent())?.startsWith("Follow(")) throw new Error("Shift release not read live");
  await page.mouse.up();
  await page.waitForSelector('[data-part="wire"][data-term="follow"]');
});

scenario("wire menu → Unlink · keep the last value: badge ⏸, wire gone, Resume unavailable with its reason", async (page) => {
  await page.goto(story("shop-scenes--scene-7-connect-mode"));
  await page.waitForSelector('[data-part="wire"]');
  // Two wires are on screen (detail and inspector); the one into the detail's order port is the subject.
  const wire = page.locator('[data-part="wire"][data-destination$="/order"] [data-part="wire-hit"]').first();
  await wire.click({ button: "right", force: true });
  await page.getByRole("menuitem", { name: /^Unlink · keep the last value/ }).click();
  await page.waitForSelector('[data-part="port-badge"][data-state="held"]');
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-part="port-rail"]', { state: "detached" });
  await page.locator('[data-ptype="port"]:has([data-port$="/order"])').click();
  // The reason is part of the row's ACCESSIBLE NAME (what a screen reader says), not its visible text.
  const resume = page.getByRole("menuitem", { name: /^Resume/ });
  if (!(await resume.isDisabled())) throw new Error("Resume should be unavailable after an unlink");
  if ((await page.getByRole("menuitem", { name: /^Resume.*nothing to resume/ }).count()) !== 1) throw new Error("Resume does not explain itself");
});

scenario("Show details… with no detail open: tile count +1, the new tile follows the table in one batch", async (page) => {
  await page.goto(story("shop-scenes--scene-3-spawn"));
  await page.waitForSelector('[data-part="orders-table"]');
  const before = await page.locator("[data-placement-id]").count();
  await page.locator('tr[data-order-id="88155"] [data-ptype="order"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Show details…/ }).click();
  await page.waitForSelector('[data-part="order-detail"]');
  if ((await page.locator("[data-placement-id]").count()) !== before + 1) throw new Error("tile count did not grow by one");
  if ((await badge(page)) !== "following:→orders") throw new Error(`badge was ${await badge(page)}`);
  if (!(await detailTitle(page))?.includes("order #88155")) throw new Error("spawned detail does not show #88155");
});

scenario("identity: the shared selection is a double wire; Unlink · restore private values gives each side its own selection back", async (page) => {
  await page.goto(story("shop-scenes--scene-5-identity"));
  await page.waitForSelector('[data-part="port-badge"][data-state="shared"]');
  if ((await page.locator('[data-part="port-badge"][data-state="shared"]').count()) !== 2) throw new Error("both members should show ≡");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+Shift+L");
  await page.waitForSelector('[data-part="wire"][data-term="identity"]');
  await page.locator('[data-part="wire"][data-term="identity"] [data-part="wire-hit"]').first().click({ button: "right", force: true });
  await page.getByRole("menuitem", { name: /^Unlink · restore private values/ }).click();
  await page.waitForSelector('[data-part="wire"][data-term="identity"]', { state: "detached" });
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-part="port-rail"]', { state: "detached" });
  if ((await page.locator('[data-part="port-badge"][data-state="shared"]').count()) !== 0) throw new Error("≡ badges should be gone");
  // The table keeps its two pre-merge rows selected (its private history).
  if ((await page.locator('[data-part="orders-table"] tr[data-selected]').count()) !== 2) throw new Error("the table did not get its private selection back");
});

scenario("Ctrl-drag onto an incompatible port is refused with the field named", async (page) => {
  await page.goto(story("shop-scenes--scene-5-incompatible"));
  await page.waitForSelector('[data-part="port-rail"]');
  const from = page.locator('[data-part="port-rail-port"][data-side="out"][data-port-id$="/selection"]').first();
  const to = page.locator('[data-part="port-rail-port"][data-side="in"][data-port-id$="/selection"]').last();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.keyboard.down("Control");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  const label = await page.locator('[data-part="wire-cursor"]').textContent();
  if (!label?.startsWith("cannot share with")) throw new Error(`cursor said: ${label}`);
  if ((await to.getAttribute("data-acceptable")) !== "false") throw new Error("the sales plot should not be acceptable");
  await page.mouse.up();
  await page.keyboard.up("Control");
  if ((await page.locator('[data-part="wire"]').count()) !== 0) throw new Error("no wire should have been declared");
});

const browser = await chromium.launch();
let failed = 0;
for (const { name, run } of scenarios) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  const page = await context.newPage();
  try {
    await run(page);
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`);
    await page.screenshot({ path: `e2e/failed-${scenarios.indexOf(scenarios.find((s) => s.name === name)) + 1}.png` }).catch(() => undefined);
  } finally {
    await context.close();
  }
}
await browser.close();
console.log(failed === 0 ? `\n${scenarios.length} scenarios passed` : `\n${failed} of ${scenarios.length} scenarios failed`);
process.exit(failed === 0 ? 0 : 1);
