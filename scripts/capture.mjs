// Headless Chrome screenshot: node scripts/capture.mjs <name> <url> <width> <height>
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [name, url, width = "1536", height = "1024"] = process.argv.slice(2);
if (!name || !url) {
  console.error("usage: node scripts/capture.mjs <name> <url> [width] [height]");
  process.exit(1);
}
mkdirSync("shots", { recursive: true });
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const out = resolve("shots", `${name}.png`);
const result = spawnSync(
  chrome,
  [
    "--headless=new",
    "--no-first-run",
    `--user-data-dir=${join(tmpdir(), "shareback-shot")}`,
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    `--virtual-time-budget=${process.env.BUDGET || 9000}`,
    `--screenshot=${out}`,
    url,
  ],
  { stdio: "ignore" },
);
console.log(result.status === 0 ? out : `chrome exited with ${result.status}`);
