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

test("Home preserves the existing hero and delegates its new content below the fold", async () => {
  const page = await read("app/page.tsx");

  assert.match(page, /import \{ ExploreHero \}/);
  assert.match(page, /<ExploreHero \/>/);
  assert.match(page, /<HomeTaskEntry/);
  assert.match(page, /id="main-content"/);
  assert.doesNotMatch(
    page,
    /ExploreExperience|DiscoveryControls|ExploreResults/,
  );
});

test("Explore hero composes approved copy, controlled search, facts, and artwork", async () => {
  const hero = await read("components/explore-hero/explore-hero.tsx");

  assert.match(hero, /Find better design resources, faster\./);
  assert.match(hero, /manually curated index/);
  assert.match(hero, /web and product design/);
  assert.match(hero, /<ExploreSearch/);
  assert.match(hero, /value=\{searchValue\}/);
  assert.match(hero, /onValueChange=\{onSearchValueChange\}/);
  assert.match(hero, /onQueryChange=\{onSearchQueryChange\}/);
  assert.match(hero, /<ExploreFacts \/>/);
  assert.doesNotMatch(hero, /testimonial|trusted by|users love|weekly/i);
  assert.doesNotMatch(hero, /category navigation|filter|resource card/i);
});

test("hero artwork is decorative, stable, responsive, and preloaded", async () => {
  const hero = await read("components/explore-hero/explore-hero.tsx");

  assert.match(hero, /src="\/brand\/tessli-hero-geometry\.webp"/);
  assert.match(hero, /alt=""/);
  assert.match(hero, /width=\{900\}/);
  assert.match(hero, /height=\{614\}/);
  assert.match(hero, /preload/);
  assert.match(hero, /unoptimized/);
  assert.match(hero, /sizes=/);
  assert.match(hero, /aria-hidden="true"/);
});

test("hero layout recomposes instead of shrinking, hiding, or animating", async () => {
  const css = await read("components/explore-hero/explore-hero.module.css");

  assert.match(css, /grid-column: 1 \/ span 6/);
  assert.match(css, /grid-column: 7 \/ -1/);
  assert.match(css, /width: min\(132%, 920px\)/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /grid-column: 1 \/ span 5/);
  assert.match(css, /grid-column: 6 \/ -1/);
  assert.match(css, /width: min\(142%, 680px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /overflow: hidden/);
  assert.match(css, /width: min\(600px, 155vw\)/);
  assert.match(css, /@media \(max-width: 389px\)[\s\S]*?height: 120px/);
  assert.doesNotMatch(css, /\.artwork\s*\{[\s\S]*?display: none/);
  assert.doesNotMatch(css, /animation:/);
});

test("global overflow QA is independent from the grain control", async () => {
  const [layout, probe, grainToggle] = await Promise.all([
    read("app/layout.tsx"),
    read("components/viewport-overflow-probe/viewport-overflow-probe.tsx"),
    read("app/lab/grain-toggle.tsx"),
  ]);

  assert.match(layout, /<ViewportOverflowProbe \/>/);
  assert.match(probe, /data.*horizontalOverflow|horizontalOverflow/);
  assert.match(probe, /ResizeObserver/);
  assert.doesNotMatch(grainToggle, /horizontalOverflow|ResizeObserver/);
});
