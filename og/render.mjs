// Render the rokstones.io Open Graph cards (1200x630) with headless Chrome:
// one home card (<out>/og.png) and one per stone (<out>/og/<name>.png),
// filled from og/manifest.tsv (card<TAB>name<TAB>version<TAB>description;
// the home card has no name), which the site build writes. Each card gets
// a <png>.v naming the card version it was drawn from: the server caches
// og.png?v=<that> for good, and rebuilds keep the card while it matches.
// A card whose .v already matches is skipped; delete the .v to redraw it.
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
const read = (f) => readFileSync(join(here, f), "utf8");
const fill = (tpl, d) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(d[k] ?? ""));

// Glyph from the name, as in src/layout.rok.
const glyph = (name) => {
  let h = 7;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) % 9973;
  return { HUE: h % 360, ROT: (h % 70) - 35, SX: ((80 + (h % 25)) / 100).toFixed(2) };
};

const cards = [];
if (existsSync(manifestPath)) {
  const tpl = read("stone.html");
  for (const line of readFileSync(manifestPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [v, name, vers, ...rest] = line.split("\t");
    if (!name) {
      cards.push({ out: join(outDir, "og.png"), v, html: read("home.html") });
      continue;
    }
    const desc = rest.join("\t") || `${name} ${vers}, a Rok stone`;
    cards.push({ out: join(outDir, "og", `${name}.png`), v, html: fill(tpl, { NAME: name, VERS: vers, DESC: desc, ...glyph(name) }) });
  }
}
if (!cards.some((c) => c.out === join(outDir, "og.png"))) cards.unshift({ out: join(outDir, "og.png"), v: "", html: read("home.html") });

mkdirSync(join(outDir, "og"), { recursive: true });
const drawn = (c) => c.v && existsSync(c.out) && existsSync(c.out + ".v") && readFileSync(c.out + ".v", "utf8").trim() === c.v;
const todo = cards.filter((c) => !drawn(c));
if (!todo.length) process.exit(0);
const browser = await puppeteer.launch({
  executablePath: chrome(), headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});
const tmp = join(here, "_render.html");
try {
  for (const c of todo) {
    writeFileSync(tmp, c.html);
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle0" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: c.out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await page.close();
    if (c.v) writeFileSync(c.out + ".v", c.v + "\n");
    else rmSync(c.out + ".v", { force: true });
    console.log("wrote", c.out);
  }
} finally {
  rmSync(tmp, { force: true });
  await browser.close();
}
