// Screenshot the reference look the user named: the pbui-agent-workbench artifact.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../..");
const require = createRequire(path.join(repoRoot, "packages/pbui-ecommerce/package.json"));
const { chromium } = require("playwright");
const out = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://artifacts.yolo.scapegoat.dev/view/pbui-agent-workbench", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: false });
console.log(await page.title());
await browser.close();
