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

test("V3.11 Collections index renders the six canonical research paths", async () => {
  const [page, card, sourceText] = await Promise.all([
    read("app/collections/page.tsx"),
    read("components/collection-card/collection-card.tsx"),
    readFile(
      path.resolve(webRoot, "..", "lib_data", "tessli-launch-collections.json"),
      "utf8",
    ),
  ]);
  const source = JSON.parse(sourceText);
  const publishedSlugs = source.collections
    .filter((collection) => collection.status === "published")
    .map((collection) => collection.slug);

  assert.equal(publishedSlugs.length, 6);
  assert.deepEqual(publishedSlugs, [
    "saas-landing-pages",
    "typography-font-tools",
    "motion-starter-pack",
    "open-source-ui-libraries",
    "accessible-colour-tools",
    "design-systems-worth-studying",
  ]);
  assert.match(page, /getPublishedCollections\(\)/);
  assert.match(page, /collections\.map\(\(collection\)/);
  assert.match(card, /data-collection-card/);
  assert.match(card, /href=\{`\/collections\/\$\{collection\.slug\}`\}/);
  assert.match(card, /<h3>\{collection\.title\}<\/h3>/);
  assert.equal((card.match(/<Link/g) ?? []).length, 1);
  assert.doesNotMatch(card, /<button|onClick/);
});

test("V3.11 Collection cards state their research-path decision anatomy", async () => {
  const card = await read("components/collection-card/collection-card.tsx");

  assert.match(card, />Goal</);
  assert.match(card, /collection\.description/);
  assert.match(card, />Outcome</);
  assert.match(card, /collection\.outcome/);
  assert.match(card, />Audience</);
  assert.match(card, /collection\.audience/);
  assert.match(card, />Stages</);
  assert.match(card, /collection\.stages\.length/);
  assert.match(card, />Expected decision</);
  assert.match(
    card,
    /collection\.stages\[collection\.stages\.length - 1\]\?\.decision/,
  );
});

test("V3.11 index removes audit and popularity framing and includes an empty state", async () => {
  const [page, card] = await Promise.all([
    read("app/collections/page.tsx"),
    read("components/collection-card/collection-card.tsx"),
  ]);
  const primaryFlow = `${page}\n${card}`;

  assert.match(page, /Which guided research path matches my goal\?/);
  assert.match(page, /collections\.length > 0/);
  assert.match(page, /No guided research paths are published yet/);
  assert.doesNotMatch(
    primaryFlow,
    /defensible|audit|reviewed|curator|trending|popular|recent|source count/i,
  );
});

test("V3.11 index and cards preserve responsive and focus safeguards", async () => {
  const [indexCss, cardCss] = await Promise.all([
    read("app/collections/collections.module.css"),
    read("components/collection-card/collection-card.module.css"),
  ]);

  assert.match(
    indexCss,
    /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(indexCss, /@media \(max-width: 1024px\)/);
  assert.match(
    indexCss,
    /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(indexCss, /@media \(max-width: 767px\)/);
  assert.match(indexCss, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(cardCss, /min-width: 0/);
  assert.match(cardCss, /min-height: 44px/);
  assert.match(cardCss, /\.link:focus-visible/);
  assert.match(cardCss, /@media \(prefers-reduced-motion: reduce\)/);
});
