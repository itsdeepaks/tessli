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

test("source detail uses recorded intelligence as guidance and keeps diagnostics quiet", async () => {
  const [page, detail] = await Promise.all([
    read("app/resources/[slug]/page.tsx"),
    read("components/source-detail/intelligence-detail.tsx"),
  ]);

  assert.ok(page.includes("getSimilarSourceProfiles(profile, 4)"));
  assert.ok(page.includes("<IntelligenceDetail profile={profile}"));
  assert.ok(detail.includes("What to explore"));
  assert.ok(detail.includes("How to access it"));
  assert.ok(detail.includes("Recorded governance"));
  assert.ok(detail.includes("Recorded references"));
  assert.ok(detail.includes("Source details and references"));
  assert.ok(detail.includes("does not imply live provider verification"));
  assert.doesNotMatch(
    detail,
    /Recorded capabilities and boundaries|Research intelligence/,
  );
});

test("alternatives state a recorded difference instead of overlap counts or popularity", async () => {
  const [detail, similar] = await Promise.all([
    read("components/source-detail/intelligence-detail.tsx"),
    read("lib/similar-sources.ts"),
  ]);

  assert.ok(detail.includes("match.differentiator"));
  assert.ok(similar.includes("candidate.category === source.category"));
  assert.ok(similar.includes("Recorded task fit"));
  assert.ok(similar.includes("Recorded capability"));
  assert.ok(similar.includes("Recorded access route"));
  assert.doesNotMatch(
    similar,
    /overlapCount|shared capabilities|contentObjects.*overlap/i,
  );
  assert.doesNotMatch(`${detail}\n${similar}`, /popularity|rating|trend/i);
});
