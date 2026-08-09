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

test("Playbook adapter resolves staged roles from canonical catalogue data", async () => {
  const adapter = await read("lib/collections.ts");

  assert.match(adapter, /export type PlaybookStage/);
  assert.match(adapter, /outcome: string/);
  assert.match(adapter, /audience: string/);
  assert.match(adapter, /role: string/);
  assert.match(adapter, /stageId: string/);
  assert.match(adapter, /collection\.stages\.map/);
  assert.match(adapter, /stages\.flatMap/);
  assert.doesNotMatch(adapter, /fetch\(|Date\.now\(|Math\.random/);
});

test("Collections index uses research-path framing and canonical collections", async () => {
  const page = await read("app/collections/page.tsx");

  assert.match(page, /title: "Collections"/);
  assert.match(page, /Which guided research path matches my goal\?/);
  assert.match(page, /Guided research paths/);
  assert.match(page, /collections\.map/);
  assert.match(page, /data-collections-grid/);
  assert.match(page, /<CollectionCard collection=\{collection\}/);
  assert.doesNotMatch(
    page,
    /Trending|Recent|popularity ranking|reviewed|<input/i,
  );
});

test("Collection cards expose goal, audience, stages, and expected decision", async () => {
  const card = await read("components/collection-card/collection-card.tsx");

  assert.match(
    card,
    /data-collection-stage-count=\{collection\.stages\.length\}/,
  );
  assert.match(card, /collection\.stages\.length/);
  assert.match(card, /collection\.description/);
  assert.match(card, /collection\.outcome/);
  assert.match(card, /collection\.audience/);
  assert.match(card, /Expected decision/);
  assert.match(card, /href=\{`\/collections\/\$\{collection\.slug\}`\}/);
  assert.doesNotMatch(
    card,
    /button|onClick|curator|avatar|trending\b|popular\b|reviewed/i,
  );
});

test("Playbook detail exposes intent, stages, roles, Board, and exports", async () => {
  const [detail, resourceList, resourceCard] = await Promise.all([
    read("app/collections/[slug]/page.tsx"),
    read("components/collection-resources/collection-resource-list.tsx"),
    read("components/resource-card/resource-card.tsx"),
  ]);

  assert.match(detail, /export const dynamicParams = false/);
  assert.match(
    detail,
    /data-playbook-stage-count=\{playbook\.stages\.length\}/,
  );
  assert.match(detail, /playbook\.outcome/);
  assert.match(detail, /playbook\.audience/);
  assert.match(detail, /playbook\.stages\.map/);
  assert.match(detail, /data-playbook-stage=\{stage\.id\}/);
  assert.match(detail, /stage\.inspect/);
  assert.match(detail, /stage\.decision/);
  assert.match(detail, /href="\/boards"/);
  assert.match(detail, /collection\.md/);
  assert.match(detail, /collection\.json/);
  assert.match(detail, /resources=\{stage\.resources\}/);

  assert.match(resourceList, /data-playbook-resource-role/);
  assert.match(resourceList, /Why included/);
  assert.match(resourceList, /\{role\}/);
  assert.match(resourceList, /onSavedChange=\{handleSavedChange\}/);
  assert.match(resourceList, /saved=\{savedIds\.includes\(resource\.id\)\}/);
  assert.match(resourceCard, /data-resource-visit=\{resource\.id\}/);
  assert.match(resourceCard, /target="_blank"/);
  assert.match(resourceCard, /rel="noopener noreferrer"/);
});

test("Collection layouts use bounded grids and responsive collapse", async () => {
  const [cardCss, indexCss, detailCss, resourceCss] = await Promise.all([
    read("components/collection-card/collection-card.module.css"),
    read("app/collections/collections.module.css"),
    read("app/collections/[slug]/collection-detail.module.css"),
    read("components/collection-resources/collection-resource-list.module.css"),
  ]);

  assert.match(cardCss, /min-height: 44px/);
  assert.match(
    indexCss,
    /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    indexCss,
    /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(detailCss, /\.stageList/);
  assert.match(detailCss, /\.stageGuidance/);
  assert.match(
    detailCss,
    /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(detailCss, /@media \(max-width: 1100px\)/);
  assert.match(detailCss, /@media \(max-width: 767px\)/);
  assert.match(resourceCss, /\.role/);
  assert.doesNotMatch(
    `${cardCss}\n${indexCss}\n${detailCss}\n${resourceCss}`,
    /backdrop-filter|border-radius: 1[2-9]px/,
  );
});
