import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  BOARD_AGENT_HANDOFF_CONTRACT,
  createBoardAgentHandoff,
} from "../lib/board-agent-handoff.mjs";

const profiledSource = {
  id: "profiled-source",
  name: "Profiled Source",
  url: "https://profiled.example",
  domain: "profiled.example",
  bestFor: ["first task", "second task", "third task", "fourth task"],
  limitations: [
    "first caveat",
    "second caveat",
    "third caveat",
    "fourth caveat",
  ],
};

const listedSource = {
  id: "listed-source",
  name: "Listed Source",
  url: "https://listed.example",
  domain: "listed.example",
};

function makeInput(overrides = {}) {
  return {
    contractVersion: 1,
    generatedAt: "2026-08-10",
    sources: [profiledSource, listedSource],
    board: {
      name: "OSS homepage research",
      goal: "Create a clear technical-partner homepage.",
      audience: "Small and medium business owners.",
      constraints: "Responsive, accessible, restrained, and original.",
      unresolvedQuestions: ["Which proof should lead?", ""],
      items: [
        {
          resourceId: "profiled-source",
          note: "Inspect structure, not visual copying.",
          decision: "selected",
          rationale: "Useful for hierarchy and technical positioning.",
        },
        {
          resourceId: "listed-source",
          note: "Check type pairing only.",
          decision: "rejected",
          rationale: "Too editorial for this project.",
        },
        {
          resourceId: "missing-source",
          note: "Keep this unresolved reference visible.",
          decision: "undecided",
          rationale: "Provider record was removed.",
        },
      ],
    },
    ...overrides,
  };
}

function artifact(result) {
  assert.equal(result.ok, true);
  return JSON.parse(result.json);
}

test("identical explicit snapshots produce byte-identical JSON", () => {
  const first = createBoardAgentHandoff(makeInput());
  const second = createBoardAgentHandoff(makeInput());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.json, second.json);
  assert.equal(first.filename, second.filename);
  assert.equal(first.json.endsWith("\n"), true);
  assert.equal(first.json.endsWith("\n\n"), false);
  assert.doesNotMatch(first.json, /\r/u);
  assert.doesNotMatch(first.json, /[ \t]+$/gmu);
});

test("the handoff separates user-selected project context from canonical source facts", () => {
  const value = artifact(createBoardAgentHandoff(makeInput()));

  assert.equal(value.contract, BOARD_AGENT_HANDOFF_CONTRACT);
  assert.equal(value.version, 1);
  assert.equal(value.generatedAt, "2026-08-10");
  assert.deepEqual(value.project, {
    name: "OSS homepage research",
    goal: "Create a clear technical-partner homepage.",
    audience: "Small and medium business owners.",
    constraints: "Responsive, accessible, restrained, and original.",
    unresolvedQuestions: ["Which proof should lead?"],
  });
  assert.match(
    value.boundaries.localContext,
    /user-selected local project context/u,
  );
  assert.match(value.boundaries.sourceTruth, /not live\/provider truth/u);
  assert.match(
    value.boundaries.modelAccess,
    /does not grant a model automatic access/u,
  );

  const selected = value.sources.selected[0];
  assert.deepEqual(selected.source, {
    id: "profiled-source",
    name: "Profiled Source",
    url: "https://profiled.example",
    domain: "profiled.example",
    canonicalSourceAvailable: true,
    taskGuidance: ["first task", "second task", "third task"],
    caveats: ["first caveat", "second caveat", "third caveat"],
  });
  assert.deepEqual(selected.projectDecision, {
    decision: "selected",
    rationale: "Useful for hierarchy and technical positioning.",
    note: "Inspect structure, not visual copying.",
  });
});

test("decision groups retain Board order and stale canonical IDs remain explicit", () => {
  const input = makeInput();
  input.board.items = [
    input.board.items[2],
    input.board.items[1],
    input.board.items[0],
    {
      resourceId: "second-profiled-source",
      note: "Second selected note.",
      decision: "selected",
      rationale: "Second selected rationale.",
    },
  ];
  const value = artifact(createBoardAgentHandoff(input));

  assert.deepEqual(
    value.sources.selected.map((record) => record.source.id),
    ["profiled-source", "second-profiled-source"],
  );
  assert.deepEqual(
    value.sources.rejected.map((record) => record.source.id),
    ["listed-source"],
  );
  assert.deepEqual(
    value.sources.undecided.map((record) => record.source.id),
    ["missing-source"],
  );
  assert.deepEqual(value.sources.undecided[0].source, {
    id: "missing-source",
    name: null,
    url: null,
    domain: null,
    canonicalSourceAvailable: false,
    taskGuidance: [],
    caveats: [],
  });
});

test("normalization and the explicit generated date are deterministic", () => {
  const input = makeInput();
  input.board.goal = "First line  \r\nSecond line\t";
  input.board.audience = "  \r\n";
  input.board.unresolvedQuestions = ["Question line  \r\ncontinued\t"];
  input.board.items[0].note = "Primary note  \r\nContinuation\t";

  const first = createBoardAgentHandoff(input);
  const second = createBoardAgentHandoff(
    makeInput({ generatedAt: "2026-08-11" }),
  );
  const firstArtifact = artifact(first);
  const secondArtifact = artifact(second);
  assert.equal(firstArtifact.project.goal, "First line\nSecond line");
  assert.equal(firstArtifact.project.audience, null);
  assert.equal(
    firstArtifact.sources.selected[0].projectDecision.note,
    "Primary note\nContinuation",
  );
  assert.deepEqual(firstArtifact.project.unresolvedQuestions, [
    "Question line\ncontinued",
  ]);

  const sameSnapshotWithNewDate = createBoardAgentHandoff({
    ...input,
    generatedAt: "2026-08-11",
  });
  const normalizedFirst = first.json.replace(/2026-08-10/u, "DATE");
  const normalizedSecond = sameSnapshotWithNewDate.json.replace(
    /2026-08-11/u,
    "DATE",
  );
  assert.equal(normalizedFirst, normalizedSecond);
  assert.equal(secondArtifact.generatedAt, "2026-08-11");
});

test("validation uses the existing Board export relevance boundary without truncating", () => {
  const noSelection = makeInput();
  noSelection.board.items = noSelection.board.items.map((item) => ({
    ...item,
    decision: "undecided",
  }));
  assert.deepEqual(createBoardAgentHandoff(noSelection), {
    ok: false,
    errors: ["Select at least one source before exporting."],
  });

  const tooMany = makeInput();
  tooMany.board.items = Array.from({ length: 13 }, (_, index) => ({
    resourceId: `source-${index}`,
    note: "",
    decision: "selected",
    rationale: "",
  }));
  assert.deepEqual(createBoardAgentHandoff(tooMany), {
    ok: false,
    errors: ["Select no more than 12 sources before exporting."],
  });

  const invalid = makeInput({ generatedAt: "2026-02-30" });
  invalid.board.name = "";
  invalid.board.goal = "";
  invalid.board.items = [invalid.board.items[0], { ...invalid.board.items[0] }];
  const result = createBoardAgentHandoff(invalid);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes("Generated date must be a valid YYYY-MM-DD value."),
  );
  assert.ok(result.errors.includes("Board name is required."));
  assert.ok(result.errors.includes("Project goal is required."));
  assert.ok(result.errors.includes("Duplicate Board source: profiled-source."));
});

test("the handoff filename is deterministic and JSON-safe", () => {
  const result = createBoardAgentHandoff(
    makeInput({
      board: {
        ...makeInput().board,
        name: " Café / OSS Homepage ",
      },
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.filename, "tessli-cafe-oss-homepage-agent-handoff.json");

  const fallback = createBoardAgentHandoff(
    makeInput({
      board: { ...makeInput().board, name: "***" },
    }),
  );
  assert.equal(fallback.ok, true);
  assert.equal(fallback.filename, "tessli-agent-handoff.json");
});

test("the pure formatter has no network or current-clock dependency", async () => {
  const source = await readFile(
    new URL("../lib/board-agent-handoff.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /Date\.now\(|new Date\(|fetch\(|XMLHttpRequest|navigator\./u,
  );
});
