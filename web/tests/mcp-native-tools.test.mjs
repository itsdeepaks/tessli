import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_MCP_LIMITS,
  NativeMcpInputError,
  createNativeResearchBrief,
  findNativeAlternatives,
  findNativeSources,
  getNativeCollection,
  getNativeSource,
} from "../lib/mcp-native-tools.ts";
import { retrieveTaskSources } from "../lib/task-retrieval.ts";

const retrievalInput = {
  task: "Build a React animation",
  surface: "page transitions",
  framework: "react",
  needs: ["page transitions"],
};

test("find_sources delegates to the deterministic V3.7 task retrieval contract", () => {
  const first = findNativeSources(retrievalInput);
  const second = findNativeSources({
    ...retrievalInput,
    needs: ["page-transitions", "page transitions"],
  });

  assert.deepEqual(first, retrieveTaskSources(retrievalInput));
  assert.deepEqual(first, second);
  assert.equal(first.input.task, "build a react animation");
  assert.ok(first.sources.length <= 8);

  const motion = first.sources.find((source) => source.slug === "motion");
  assert.ok(motion);
  assert.ok(motion.fitReasons.length > 0);
  assert.ok(motion.caveats.length > 0);
  assert.ok(motion.accessRoutes.length > 0);
  assert.ok(motion.alternatives.length > 0);
});

test("get_source exposes compact canonical action guidance and recorded caveats", () => {
  const bySlug = getNativeSource("motion");
  const byId = getNativeSource(bySlug.source.id);

  assert.deepEqual(bySlug, byId);
  assert.equal(bySlug.source.slug, "motion");
  assert.ok(bySlug.source.whatItHelpsWith.length > 0);
  assert.ok(bySlug.source.whatToInspect.length > 0);
  assert.ok(bySlug.source.accessRoutes.some((route) => route.preferred));
  assert.ok(bySlug.source.caveats.length > 0);
  assert.ok(bySlug.alternatives.length <= NATIVE_MCP_LIMITS.sourceAlternatives);
  assert.ok(
    bySlug.alternatives.every((alternative) => alternative.differentiator),
  );
  assert.match(bySlug.boundary, /not a live provider/i);

  const listed = getNativeSource("designindex");
  assert.deepEqual(listed.source.whatItHelpsWith, []);
  assert.deepEqual(listed.source.caveats, []);
  assert.match(
    listed.source.coverageNote,
    /no structured intelligence profile/i,
  );

  assert.throws(
    () => getNativeSource("not-a-tessli-resource"),
    NativeMcpInputError,
  );
});

test("find_alternatives is deterministic, capped, and differentiates recorded metadata", () => {
  const first = findNativeAlternatives("motion", 2);
  const second = findNativeAlternatives("motion", 2);

  assert.deepEqual(first, second);
  assert.equal(first.limit, 2);
  assert.ok(first.alternatives.length <= 2);
  assert.ok(
    first.alternatives.every(
      (alternative) =>
        alternative.id !== first.source.id &&
        alternative.differentiator.startsWith("Recorded "),
    ),
  );
  assert.throws(
    () => findNativeAlternatives("motion", NATIVE_MCP_LIMITS.alternatives + 1),
    NativeMcpInputError,
  );
});

test("get_collection preserves editorial order with canonical source guidance", () => {
  const collection = getNativeCollection("saas-landing-pages");

  assert.equal(collection.slug, "saas-landing-pages");
  assert.equal(collection.status, "published");
  assert.equal(collection.resourceCount, 10);
  assert.equal(collection.returnedSourceCount, 10);
  assert.deepEqual(
    collection.sources.map((source) => source.order),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.ok(collection.stages.length > 0);
  assert.ok(
    collection.stages.every((stage) =>
      stage.sources.every((item) =>
        collection.sources.some((source) => source.id === item.sourceId),
      ),
    ),
  );
  assert.match(collection.boundary, /repository-recorded/i);
});

test("create_research_brief is deterministic and shares V3.7 explained results", () => {
  const first = createNativeResearchBrief(retrievalInput);
  const second = createNativeResearchBrief({
    ...retrievalInput,
    needs: ["page-transitions", "page transitions"],
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first.sources, retrieveTaskSources(retrievalInput).sources);
  assert.equal(first.sourceCount, first.sources.length);
  assert.equal(first.nextSteps.length, 3);
  assert.match(first.boundary, /does not access local Boards/i);
});
