import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(currentFile), "..");
const require = createRequire(import.meta.url);
const typescript = require("typescript");

async function read(relativePath) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

async function loadBrowseModule() {
  const source = await read("lib/browse.ts");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("exports", "module", compiled)(
    compiledModule.exports,
    compiledModule,
  );
  return compiledModule.exports;
}

test("V3.4 Browse URL state is task-focused, bounded, and shareable", async () => {
  const browse = await read("lib/browse.ts");
  const { parseBrowseState, serializeBrowseState } = await loadBrowseModule();

  for (const field of [
    "query",
    "category",
    "access",
    "sourceType",
    "sort",
    "page",
  ]) {
    assert.match(browse, new RegExp(`\\b${field}:`));
  }

  for (const parameter of [
    "q",
    "category",
    "access",
    "sourceType",
    "sort",
    "page",
  ]) {
    assert.match(browse, new RegExp(`"${parameter}"`));
  }

  assert.match(browse, /slice\(0, 160\)/);
  assert.match(browse, /Number\.isSafeInteger\(number\) && number > 0/);
  assert.match(browse, /const pageSize = 24;/);
  assert.match(browse, /filtered\.slice\(start, start \+ pageSize\)/);
  assert.match(
    browse,
    /if \(state\.page > 1\) params\.set\("page", String\(state\.page\)\)/,
  );
  assert.doesNotMatch(browse, /profileLevel|BrowseView|browseViewValues|view:/);

  const state = parseBrowseState(
    {
      q: "  accessible\t dashboard  ",
      category: "product-design",
      access: ["free,paid", "free-trial"],
      sourceType: "component-library",
      profileLevel: "profiled",
      view: "table",
      sort: "name-desc",
      page: "2",
    },
    new Set(["product-design"]),
    new Set(["component-library"]),
  );

  assert.deepEqual(state, {
    query: "accessible dashboard",
    category: "product-design",
    access: ["free", "paid", "free-trial"],
    sourceType: "component-library",
    sort: "name-desc",
    page: 2,
  });
  assert.equal(
    serializeBrowseState(state),
    "q=accessible+dashboard&category=product-design&access=free%2Cpaid%2Cfree-trial&sourceType=component-library&sort=name-desc&page=2",
  );
});

test("V3.4 Browse always paginates card results in stable groups of 24", async () => {
  const { deriveBrowseResults, defaultBrowseState } = await loadBrowseModule();
  const profiles = Array.from({ length: 25 }, (_, index) => ({
    id: `source-${index + 1}`,
    name: `Source ${String(index + 1).padStart(2, "0")}`,
    domain: `source-${index + 1}.example`,
    summary: "A source for dashboard research.",
    category: "product-design",
    sourceType: "component-library",
    accessModel: { access: "free" },
    bestFor: [],
    capabilities: [],
    contentObjects: [],
    platforms: [],
    frameworks: [],
  }));

  const result = deriveBrowseResults(profiles, {
    ...defaultBrowseState,
    page: 2,
  });

  assert.equal(result.pageSize, 24);
  assert.equal(result.pageCount, 2);
  assert.equal(result.page, 2);
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].id, "source-25");
});

test("V3.4 Browse always renders resource cards with independent actions", async () => {
  const results = await read("components/browse/browse-results.tsx");

  assert.match(
    results,
    /export function BrowseResults\(\{ resources \}: BrowseResultsProps\)/,
  );
  assert.match(results, /<ResourceCard/);
  assert.match(results, /profileHref=\{`\/resources\/\$\{profile\.slug\}`\}/);
  assert.match(results, /onSavedChange=\{handleSavedChange\}/);
  assert.match(results, /readSavedResourceIds\(cards\)/);
  assert.match(results, /writeSavedResourceIds\(next\)/);
  assert.match(results, /aria-live="polite"/);
  assert.match(results, /data-browse-view="cards"/);
  assert.doesNotMatch(results, /if \(view|table|compactList|profileLevel/);
});
