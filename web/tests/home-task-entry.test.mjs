import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(currentFile), "..");

async function read(relativePath) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

test("Home routes task starters into canonical Browse without recreating it", async () => {
  const home = await read("components/home-task-entry/home-task-entry.tsx");

  assert.match(home, /data-home-task-entry/);
  assert.match(home, /What are you trying to design\?/);
  assert.match(home, /href: "\/resources\?q=landing"/);
  assert.match(home, /href: "\/resources\?q=motion"/);
  assert.match(home, /href: "\/resources\?q=accessibility"/);
  assert.match(
    home,
    /<CollectionCard collection=\{collection\} variant="compact" \/>/,
  );
  assert.match(home, /href="\/for-ai"/);
  assert.doesNotMatch(
    home,
    /ResourceCard|BrowseResults|DiscoveryControls|data-resource-grid/,
  );
});

test("Home task entry keeps the research loop readable and responsive", async () => {
  const css = await read(
    "components/home-task-entry/home-task-entry.module.css",
  );

  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /backdrop-filter|border-radius: 1[2-9]px/);
});
