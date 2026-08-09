import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(currentFile), "..");

async function read(relativePath) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function quotedPath(pathname) {
  return new RegExp(`["']${escapeRegex(pathname)}["']`);
}

test("robots metadata advertises the sitemap and blocks unpublished routes", async () => {
  const robots = await read("app/robots.ts");

  assert.match(robots, /MetadataRoute\.Robots/);
  assert.match(robots, /disallow:\s*\[/);
  assert.match(robots, /sitemap/i);
  assert.match(robots, /sitemap\.xml/);

  for (const pathname of [
    "/auth",
    "/submit",
    "/suggest",
    "/boards",
    "/lab/",
    "/proofs/",
  ]) {
    assert.match(robots, quotedPath(pathname), `robots disallows ${pathname}`);
  }
});

test("llms discovery route is static, deterministic, and bounded to public truth", async () => {
  const route = await read("app/llms.txt/route.ts");

  assert.match(route, /export const dynamic = ["']force-static["']/);
  assert.match(route, /export const revalidate = false/);
  assert.match(route, /text\/plain(?:;\s*charset=utf-8)?/i);
  assert.match(route, /export (?:async )?function GET/);
  assert.match(route, /export (?:async )?function HEAD/);
  assert.match(route, /export (?:async )?function OPTIONS/);
  assert.doesNotMatch(
    route,
    /Date\.now\(|new Date\(|fetch\(|XMLHttpRequest|localStorage|cookies\(/u,
  );

  for (const fragment of [
    "/resources",
    "/collections",
    "/resources/landingfolio/profile.json",
    "/resources/landingfolio/profile.md",
    "/collections/saas-landing-pages/collection.json",
    "/collections/saas-landing-pages/collection.md",
  ]) {
    assert.match(route, new RegExp(fragment.replaceAll("/", "\\/")));
  }

  assert.match(route, /local\s+MCP/i);
  assert.match(route, /no hosted(?: or remote)? MCP endpoint/i);
  assert.match(route, /(?:no|not)\b[\s\S]{0,80}\bbulk\b/i);
  assert.match(
    route,
    /No Board or Saved data is public:[\s\S]*browser-local and private/i,
  );
  assert.match(route, /(?:no|not)\b[\s\S]{0,80}\bcredential/i);
  assert.match(route, /(?:no|not)\b[\s\S]{0,80}\bcrawl/i);
  assert.match(route, /(?:no|not)\b[\s\S]{0,80}\buniversal\b/i);
  assert.match(route, /(?:no|not)\b[\s\S]{0,80}\btaste\b/i);
});

test("sitemap lists only public discovery routes and machine representations", async () => {
  const sitemap = await read("app/sitemap.ts");

  for (const pathname of [
    "/resources",
    "/collections",
    "/for-ai",
    "/llms.txt",
  ]) {
    assert.match(sitemap, quotedPath(pathname), `sitemap includes ${pathname}`);
  }

  assert.match(sitemap, /getPublishedCollections\(\)\.flatMap/);
  assert.match(sitemap, /\$\{origin\}\/collections\/\$\{collection\.slug\}/);
  assert.match(sitemap, /collection\.json/);
  assert.match(sitemap, /collection\.md/);
  assert.match(sitemap, /getAllSourceProfiles\(\)\.flatMap/);
  assert.match(sitemap, /\$\{origin\}\/resources\/\$\{profile\.slug\}/);
  assert.match(sitemap, /profile\.json/);
  assert.match(sitemap, /profile\.md/);

  for (const pathname of [
    "/auth",
    "/submit",
    "/suggest",
    "/saved",
    "/boards",
    "/lab",
    "/proofs",
  ]) {
    assert.doesNotMatch(
      sitemap,
      quotedPath(pathname),
      `sitemap excludes ${pathname}`,
    );
  }
});
