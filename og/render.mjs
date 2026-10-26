// Render the rokstones.io Open Graph cards (1200x630) with headless Chrome:
// one home card (<out>/og.png) and one per stone (<out>/og/<name>.png),
// filled from og/manifest.tsv (name<TAB>version<TAB>description), which the
// site build writes.
//   node render.mjs [outDir=../public] [manifest=./manifest.tsv]
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname);
const outDir = process.argv[2] || join(here, "..", "public");
const manifestPath = process.argv[3] || join(here, "manifest.tsv");

function chrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const guesses = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
  ];
  for (const g of guesses) if (existsSync(g)) return g;
  throw new Error("no Chrome found; set CHROME_PATH");
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const RAW = new Set(["EYEBROW", "BADGE"]); // trusted literals that carry markup
const tpl = readFileSync(join(here, "stone.html"), "utf8");
const fill = (d) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (RAW.has(k) ? (d[k] ?? "") : esc(d[k] ?? "")));

const cards = [];
// Home card.
cards.push({ out: join(outDir, "og.png"), data: {
  EYEBROW: "the Rok package registry", NAME: "rok stones",
  DESC: "Find a stone, then add it with rok add <name>.", CMD: "json", VERS: "0.1.0", BADGE: "registry",
} });
// Per-stone cards.
if (existsSync(manifestPath)) {
  for (const line of readFileSync(manifestPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [name, vers, ...rest] = line.split("\t");
    const desc = rest.join("\t") || `${name} ${vers}, a Rok stone`;
    cards.push({ out: join(outDir, "og", `${name}.png`), data: {
      EYEBROW: 'a Rok stone &middot; <span class="reg">rokstones.io</span>',
      NAME: name, DESC: desc, CMD: name, VERS: vers, BADGE: "stone",
    } });
  }
}

mkdirSync(join(outDir, "og"), { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome(), headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});
const tmp = join(here, "_render.html");
try {
  for (const c of cards) {
    writeFileSync(tmp, fill(c.data));
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle0" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: c.out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await page.close();
    console.log("wrote", c.out);
  }
} finally {
  rmSync(tmp, { force: true });
  await browser.close();
}
