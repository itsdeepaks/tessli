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

test("V3 Browse is task-first and does not surface coverage or result views", async () => {
  const [page, filters] = await Promise.all([
    read("app/resources/page.tsx"),
    read("components/browse/browse-filters.tsx"),
  ]);

  assert.match(page, /What are you trying to design\?/);
  assert.match(page, /Showing sources that fit your task/);
  assert.match(filters, /accessible colour system or SaaS dashboard/);
  assert.match(filters, /label="Category"/);
  assert.match(filters, /label="Access"/);
  assert.match(filters, /label="Source type"/);
  assert.doesNotMatch(page, /Source Index · Research Intelligence|coverage/i);
  assert.doesNotMatch(filters, /profileLevel|Coverage|name="view"/i);
  assert.doesNotMatch(page, /browseViewValues|state\.view|view=\{/);
});

test("V3 Browse retains accessible filter recovery and task-preserving clear behavior", async () => {
  const filters = await read("components/browse/browse-filters.tsx");

  assert.match(filters, /event\.key === "Escape"/);
  assert.match(filters, /restoreFocus\(\)/);
  assert.match(filters, /query: state\.query/);
  assert.match(filters, /Clear refinements/);
  assert.match(filters, /data-browse-filter-sheet/);
});

test("V3 Browse has empty-state reset and query recovery without legacy result layouts", async () => {
  const [page, css] = await Promise.all([
    read("app/resources/page.tsx"),
    read("components/browse/browse.module.css"),
  ]);

  assert.match(page, /Reset Browse/);
  assert.match(page, /Keep this task/);
  assert.match(page, /<BrowseResults resources=\{resources\} \/>/);
  assert.doesNotMatch(css, /\.compactList|\.tableScroller|\.viewLinks/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
});
