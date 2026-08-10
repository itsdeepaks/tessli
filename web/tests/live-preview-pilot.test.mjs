import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function read(relativePath) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

test("live preview is a closed source-detail-only allowlist", async () => {
  const [catalogueText, page, preview, browse, resourceCard] =
    await Promise.all([
      read("data/catalogue.json"),
      read("app/resources/[slug]/page.tsx"),
      read("components/source-detail/live-preview.tsx"),
      read("app/resources/page.tsx"),
      read("components/resource-card/resource-card.tsx"),
    ]);
  const catalogue = JSON.parse(catalogueText);
  const allowed = catalogue.resources.find(
    (resource) => resource.id === "resource-affc29967a7c",
  );

  assert.equal(catalogue.resources.length, 295);
  assert.deepEqual(
    { id: allowed?.id, slug: allowed?.slug },
    { id: "resource-affc29967a7c", slug: "shadcn-ui" },
  );
  assert.deepEqual(
    [...preview.matchAll(/resourceId:\s*"([^"]+)"/g)].map((match) => match[1]),
    ["resource-affc29967a7c"],
  );
  assert.deepEqual(
    [...preview.matchAll(/src:\s*"([^"]+)"/g)].map((match) => match[1]),
    ["https://ui.shadcn.com"],
  );
  assert.match(preview, /getLivePreview\(resourceId\)/);
  assert.match(preview, /if \(!preview\) return null/);
  assert.match(page, /<LivePreview resourceId=\{profile\.id\}/);
  assert.doesNotMatch(page, /<LivePreview[^>]*resource=\{card\}/);
  assert.doesNotMatch(
    `${browse}\n${resourceCard}`,
    /LivePreview|data-live-preview|<iframe/i,
  );
  assert.doesNotMatch(preview, /fetch\(|XMLHttpRequest|proxy|mcp|auth|cloud/i);
});

test("live preview keeps static access and loads only after a user gesture", async () => {
  const [actions, preview] = await Promise.all([
    read("components/source-detail/source-actions.tsx"),
    read("components/source-detail/live-preview.tsx"),
  ]);

  assert.match(actions, /Visit source ↗/);
  assert.match(actions, /href=\{resource\.url\}/);
  assert.match(actions, /target="_blank"/);
  assert.match(preview, /useState\(false\)/);
  assert.match(preview, /data-live-preview-launch/);
  assert.match(preview, /onClick=\{\(\) => setIsOpen\(true\)\}/);
  assert.match(preview, /\{isOpen \? \(/);
  assert.match(preview, /data-live-preview-frame/);
  assert.match(preview, /src=\{preview\.src\}/);
});

test("live preview iframe and close control preserve the sandbox boundary", async () => {
  const preview = await read("components/source-detail/live-preview.tsx");

  assert.match(preview, /<iframe[\s\S]*?sandbox="allow-scripts"[\s\S]*?\/>/);
  assert.match(preview, /loading="lazy"/);
  assert.match(preview, /referrerPolicy="no-referrer"/);
  assert.match(preview, /title=\{`\$\{resourceName\} live preview`\}/);
  assert.doesNotMatch(
    preview,
    /\ballow(?:fullscreen|payment|popups|same-origin|top-navigation|downloads)?\s*=/i,
  );
  assert.match(preview, /data-live-preview-close/);
  assert.match(preview, /event\.key !== "Escape"/);
  assert.match(preview, /openerRef\.current\?\.focus\(\)/);
  assert.match(preview, /aria-controls=\{frameId\}/);
  assert.match(preview, /aria-expanded=\{isOpen\}/);
});
