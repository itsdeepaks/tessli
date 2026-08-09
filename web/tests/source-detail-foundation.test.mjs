import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const page = await readFile(
  new URL("../app/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const detail = await readFile(
  new URL(
    "../components/source-detail/intelligence-detail.tsx",
    import.meta.url,
  ),
  "utf8",
);
const styles = await readFile(
  new URL("../app/resources/[slug]/source-detail.module.css", import.meta.url),
  "utf8",
);
const sitemap = await readFile(
  new URL("../app/sitemap.ts", import.meta.url),
  "utf8",
);

test("source detail keeps the complete canonical route set", () => {
  assert.equal(catalogue.resources.length, 295);
  assert.match(page, /generateStaticParams/);
  assert.match(page, /getAllSourceProfiles\(\)/);
  assert.match(page, /dynamicParams = false/);
  assert.match(page, /data-source-detail/);
  assert.match(page, /alternates: \{ canonical:/);
});

test("source detail follows the V3.3 guide-first reading order", () => {
  for (const text of [
    "Use it when",
    "What to explore",
    "How to access it",
    "Works with",
    "Important limitations",
    "Consider instead",
    "Collections",
    "Source details and references",
  ]) {
    assert.match(`${page}\n${detail}`, new RegExp(text));
  }

  assert.match(page, /<SourceActions resource=\{card\}/);
  assert.match(page, /className=\{styles\.preview\}/);
  assert.match(page, /referrerPolicy="no-referrer"/);
  assert.match(page, /previewMark/);
  assert.doesNotMatch(page, /<iframe|coverage-title|Evidence records/);
});

test("Listed source guidance uses honest compact fallbacks", () => {
  assert.match(
    page,
    /No structured task-fit guidance is recorded for this Listed source/,
  );
  assert.match(
    detail,
    /No structured exploration points are recorded for this Listed source/,
  );
  assert.match(detail, /No structured limitation is recorded/);
  assert.match(detail, /No differentiated alternatives are recorded/);
});

test("source guide styling preserves a fixed preview and narrow-screen recomposition", () => {
  assert.match(styles, /\.preview \{/);
  assert.match(styles, /aspect-ratio: 16 \/ 10/);
  assert.match(styles, /\.previewMark/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.doesNotMatch(styles, /backdrop-filter|linear-gradient\([^\n]*purple/i);
});

test("sitemap includes every canonical source profile", () => {
  assert.match(sitemap, /getAllSourceProfiles/);
  assert.match(sitemap, /\/resources\/\$\{profile\.slug\}/);
  assert.match(sitemap, /NEXT_PUBLIC_SITE_URL/);
  assert.match(sitemap, /VERCEL_PROJECT_PRODUCTION_URL/);
});
