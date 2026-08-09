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

test("canonical Browse derives one paginated result set from source profiles", async () => {
  const [page, browse, filters] = await Promise.all([
    read("app/resources/page.tsx"),
    read("lib/browse.ts"),
    read("components/browse/browse-filters.tsx"),
  ]);

  assert.match(page, /getAllSourceProfiles\(\)/);
  assert.match(page, /parseBrowseState\(/);
  assert.match(page, /deriveBrowseResults\(/);
  assert.match(page, /<BrowseResults resources=\{resources\}/);
  assert.match(
    page,
    /redirect\(withState\(state, \{ page: result\.page \}\)\)/,
  );
  assert.match(browse, /const pageSize = 24;/);
  assert.match(browse, /filtered\.slice\(start, start \+ pageSize\)/);
  assert.match(page, /<BrowseFilters/);
  assert.match(filters, /data-browse-filter-sheet/);
  assert.match(filters, /aria-expanded=\{isOpen\}/);
  assert.match(filters, /browseHref\(\{[\s\S]*?\.\.\.defaultBrowseState/);
  assert.match(filters, /allLabel="All categories"/);
  assert.match(filters, /allLabel="All access models"/);
  assert.match(filters, /allLabel="All source types"/);
  assert.doesNotMatch(filters, /All coverage levels|profileLevel/);
  assert.match(filters, /<option value="">\{allLabel\}<\/option>/);
  assert.doesNotMatch(page, /FullReferenceExperience|fetch\(/);
});

test("reference support does not promote unready submission actions", async () => {
  const reference = await read(
    "components/full-reference/full-reference-experience.tsx",
  );

  assert.doesNotMatch(reference, /href="\/(submit|suggest)"/u);
  assert.match(reference, /href="\/curation#corrections"/u);
  assert.match(reference, /Read correction guidance/u);
});

test("Browse state is task-focused, serializable, and rejects fake verification sorting", async () => {
  const browse = await read("lib/browse.ts");

  for (const field of [
    "q",
    "category",
    "access",
    "sourceType",
    "sort",
    "page",
  ]) {
    assert.match(browse, new RegExp(`"${field}"`));
  }

  assert.match(
    browse,
    /browseSortValues = \["curated", "name-asc", "name-desc"\]/,
  );
  assert.match(
    browse,
    /Legacy sort=verified intentionally normalizes to curated/,
  );
  assert.doesNotMatch(browse, /browseSortValues[^\n]*verified/);
  assert.match(browse, /Number\.isSafeInteger\(number\) && number > 0/);
  assert.match(browse, /slice\(0, 160\)/);
});

test("Browse cards expose internal profiles plus independent save and provider actions", async () => {
  const results = await read("components/browse/browse-results.tsx");

  assert.match(results, /data-browse-view="cards"/);
  assert.match(results, /<ResourceCard/);
  assert.match(results, /profileHref=\{`\/resources\/\$\{profile\.slug\}`\}/);
  assert.match(results, /onSavedChange=\{handleSavedChange\}/);
  assert.match(results, /aria-live="polite"/);
  assert.doesNotMatch(results, /table|compactList|profileLevel/);
  assert.doesNotMatch(results, /fetch\(|sessionStorage/);
  assert.doesNotMatch(
    results,
    /browseCardPrimary|browseCardActions|inspectAction/,
  );
});

test("canonical Browse renders one responsive result tree without duplicate desktop and mobile catalogues", async () => {
  const [page, results, css] = await Promise.all([
    read("app/resources/page.tsx"),
    read("components/browse/browse-results.tsx"),
    read("components/browse/browse.module.css"),
  ]);

  assert.equal((page.match(/<BrowseResults/g) ?? []).length, 1);
  assert.doesNotMatch(
    results,
    /desktopResources|mobileResources|desktopReference|mobileReference/,
  );
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.filterFieldsOpen\s*\{/);
  assert.doesNotMatch(css, /\.table|\.compactList|\.viewLinks/);
});

test("minimum source profile routes cover all source slugs without overstating enrichment", async () => {
  const [detail, guide, actions] = await Promise.all([
    read("app/resources/[slug]/page.tsx"),
    read("components/source-detail/intelligence-detail.tsx"),
    read("components/source-detail/source-actions.tsx"),
  ]);

  assert.match(detail, /generateStaticParams/);
  assert.match(detail, /getAllSourceProfiles\(\)\.map/);
  assert.match(detail, /getSourceProfile/);
  assert.match(detail, /if \(!profile\) notFound\(\)/);
  assert.match(detail, /profile\.profileLevel/);
  assert.match(detail, /<SourceActions resource=\{card\}/);
  assert.match(detail, /Use it when/i);
  assert.match(guide, /profile\.coverage\.reason/);
  assert.match(guide, /Source details and references/i);
  assert.match(actions, /Visit source ↗/);
  assert.match(actions, /rel="noopener noreferrer"/);
  assert.doesNotMatch(detail, /rating|popularity|quality score|trend/i);
});
