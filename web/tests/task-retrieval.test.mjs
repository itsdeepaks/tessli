import assert from "node:assert/strict";
import test from "node:test";

import { getSourceProfile } from "../lib/source-profiles.ts";
import {
  MAX_TASK_RETRIEVAL_RESULTS,
  TaskRetrievalInputError,
  normalizeTaskRetrievalInput,
  retrieveTaskSources,
} from "../lib/task-retrieval.ts";

test("task retrieval normalizes equivalent structured briefs", () => {
  assert.deepEqual(
    normalizeTaskRetrievalInput({
      task: "  Build  a React landing-page  ",
      surface: " Landing Page ",
      framework: " Next-JS ",
      needs: ["MCP integration", "accessible-components", "mcp_integration"],
      exclusions: [" Paid ", "paid"],
    }),
    {
      task: "build a react landing page",
      surface: "landing page",
      framework: "next js",
      needs: ["accessible components", "mcp integration"],
      exclusions: ["paid"],
    },
  );

  assert.throws(
    () => retrieveTaskSources({ task: "  " }),
    TaskRetrievalInputError,
  );
});

test("task retrieval is capped and deterministic", () => {
  const input = {
    task: "React component library",
    framework: "react",
    needs: ["component library"],
  };
  const first = retrieveTaskSources(input);
  const second = retrieveTaskSources({
    ...input,
    needs: ["component-library", "component library"],
  });

  assert.equal(first.sources.length, MAX_TASK_RETRIEVAL_RESULTS);
  assert.ok(first.sources.length <= MAX_TASK_RETRIEVAL_RESULTS);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.sources.map((source) => source.id)).size, 8);
});

test("task retrieval returns canonical rationale, caveats, routes, and alternatives", () => {
  const result = retrieveTaskSources({
    task: "Build a React animation",
    surface: "page transitions",
    framework: "react",
    needs: ["page transitions"],
  });
  const motion = result.sources.find((source) => source.slug === "motion");
  const profile = getSourceProfile("motion");

  assert.ok(motion);
  assert.ok(profile);
  assert.equal(motion.id, profile.id);
  assert.equal(motion.url, profile.url);
  assert.ok(motion.fitReasons.length > 0);
  assert.match(motion.fitReasons.join(" "), /Recorded framework: react/u);
  assert.deepEqual(motion.caveats, profile.limitations);
  assert.deepEqual(motion.accessRoutes, profile.accessRoutes);
  assert.ok(motion.alternatives.length > 0);
  assert.notEqual(motion.alternatives[0].id, motion.id);
  assert.ok(motion.alternatives[0].differentiator.length > 0);
});

test("exclusions remove matching canonical metadata from the shortlist", () => {
  const result = retrieveTaskSources({
    task: "Build a React landing page",
    surface: "landing page",
    framework: "react",
    needs: ["section inspiration"],
    exclusions: ["landingfolio"],
  });

  assert.ok(result.sources.length > 0);
  assert.equal(
    result.sources.some((source) => source.slug === "landingfolio"),
    false,
  );
  assert.equal(
    result.sources
      .flatMap((source) => source.alternatives)
      .some((source) => source.slug === "landingfolio"),
    false,
  );
});

test("Listed sources stay sparse and disclose their recorded coverage boundary", () => {
  const result = retrieveTaskSources({ task: "DesignIndex" });
  const designindex = result.sources.find(
    (source) => source.slug === "designindex",
  );
  const profile = getSourceProfile("designindex");

  assert.ok(designindex);
  assert.ok(profile);
  assert.equal(designindex.profileLevel, "listed");
  assert.deepEqual(designindex.caveats, []);
  assert.equal(designindex.coverageNote, profile.coverage.reason);
  assert.match(designindex.coverageNote, /no structured intelligence profile/u);
  assert.deepEqual(designindex.accessRoutes, profile.accessRoutes);
});
