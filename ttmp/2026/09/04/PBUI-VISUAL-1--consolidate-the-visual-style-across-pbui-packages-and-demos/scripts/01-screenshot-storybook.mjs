// Screenshot every story of a running Storybook into a directory, with a
// manifest.json describing each shot (id, title, name, file, size, error).
//
//   node 01-screenshot-storybook.mjs <storybookBaseUrl> <outDir> [--filter=regex] [--width=1280] [--height=800] [--full]
//
// Runs anywhere in the pbui repo: playwright is resolved from
// packages/pbui-ecommerce, the one workspace package that depends on it.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../.."); // ttmp/2026/09/04/TICKET/scripts -> repo root
const require = createRequire(path.join(repoRoot, "packages/pbui-ecommerce/package.json"));
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => {
  const [k, v] = a.slice(2).split("=");
  return [k, v ?? "true"];
}));
const [base, outDir] = positional;
if (!base || !outDir) {
  console.error("usage: node 01-screenshot-storybook.mjs <storybookBaseUrl> <outDir> [--filter=regex] [--width=1280] [--height=800] [--full]");
  process.exit(2);
}
const width = Number(opt.width ?? 1280);
const height = Number(opt.height ?? 800);
const filter = opt.filter ? new RegExp(opt.filter) : null;
const full = opt.full === "true";
fs.mkdirSync(outDir, { recursive: true });

const index = await (await fetch(`${base.replace(/\/$/, "")}/index.json`)).json();
let entries = Object.values(index.entries).filter((e) => e.type === "story");
if (filter) entries = entries.filter((e) => filter.test(e.id) || filter.test(`${e.title}/${e.name}`));
entries.sort((a, b) => (a.title === b.title ? a.name.localeCompare(b.name) : a.title.localeCompare(b.title)));
console.log(`${entries.length} stories from ${base}`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const manifest = [];
const pad = (n) => String(n).padStart(3, "0");

const shoot = async (page, e, i) => {
  const file = `${pad(i + 1)}-${e.id}.png`;
  const rec = { n: i + 1, id: e.id, title: e.title, name: e.name, file };
  try {
    await page.goto(`${base.replace(/\/$/, "")}/iframe.html?id=${e.id}&viewMode=story`, { waitUntil: "load", timeout: 30000 });
    await page.waitForSelector("#storybook-root > *", { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const err = await page.locator(".sb-errordisplay:visible, .sb-show-errordisplay").count();
    if (err > 0) rec.error = (await page.locator("#error-message").textContent().catch(() => "render error"))?.trim().slice(0, 300);
    const bb = await page.locator("#storybook-root").boundingBox();
    const doc = await page.evaluate(() => {
      const root = document.querySelector("#storybook-root");
      let right = 0, bottom = 0;
      const walk = (el) => { for (const c of el.children) { const r = c.getBoundingClientRect(); if (r.width && r.height) { right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom); } if (c.children.length) walk(c); } };
      if (root) walk(root);
      return { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, right: right + window.scrollX, bottom: bottom + window.scrollY };
    });
    let shotOpts = { path: path.join(outDir, file) };
    if (full || doc.h > height) {
      shotOpts.fullPage = true;
      rec.size = `${doc.w}x${doc.h}`;
    } else {
      const w = Math.max(320, Math.min(width, Math.ceil(Math.max(doc.right, (bb?.x ?? 0) + 200) + 24)));
      const h = Math.max(120, Math.min(height, Math.ceil(Math.max(doc.bottom, (bb?.y ?? 0) + (bb?.height ?? 0)) + 24)));
      shotOpts.clip = { x: 0, y: 0, width: w, height: h };
      rec.size = `${w}x${h}`;
    }
    await page.screenshot(shotOpts);
  } catch (ex) {
    rec.error = String(ex).slice(0, 300);
  }
  manifest[i] = rec;
  console.log(`${rec.n} ${e.id} ${rec.error ? "ERROR " + rec.error : rec.size}`);
};

const workers = 4;
let next = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  const page = await context.newPage();
  while (next < entries.length) {
    const i = next++;
    await shoot(page, entries[i], i);
  }
  await page.close();
}));
await browser.close();
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} entries to ${path.join(outDir, "manifest.json")}`);
