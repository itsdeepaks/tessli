import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const currentFile = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(currentFile), "..");

async function read(relativePath) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

test("project boards use a backward-compatible versioned browser-local contract", async () => {
  const store = await read("components/project-boards/board-store.ts");
  assert.match(store, /tessli-project-boards-v1/);
  assert.match(store, /goal: string/);
  assert.match(store, /audience: string/);
  assert.match(store, /constraints: string/);
  assert.match(store, /unresolvedQuestions: readonly string\[\]/);
  assert.match(store, /decision: ProjectBoardDecision/);
  assert.match(store, /rationale: string/);
  assert.match(store, /typeof board\.audience === "string"/);
  assert.match(store, /item\.decision === "selected"/);
  assert.match(store, /item\.decision === "rejected"/);
  assert.match(store, /: "undecided";/);
  assert.match(store, /localStorage\.setItem/);
  assert.match(store, /try \{/);
  assert.match(store, /return false;/);
});

test("Source Guide adds resources to local Boards with accessible feedback", async () => {
  const [actions, intake] = await Promise.all([
    read("components/source-detail/source-actions.tsx"),
    read("components/board-intake/board-intake.tsx"),
  ]);
  assert.match(actions, /<BoardIntake resource=\{resource\} \/>/);
  for (const phrase of [
    "Add to Board",
    "Create Board and add source",
    "boardStoreKey",
    'aria-haspopup="dialog"',
    "onClose",
    "already on",
    "could not save the Board",
    "not uploaded or synced",
  ]) {
    assert.match(intake, new RegExp(phrase.replaceAll(".", "\\."), "i"));
  }
  assert.match(intake, /item\.resourceId === resource\.id/);
  assert.match(intake, /triggerRef\.current\?\.focus\(\)/);
});

test("project boards support explicit research decisions and local export", async () => {
  const experience = await read(
    "components/project-boards/project-boards-experience.tsx",
  );
  for (const phrase of [
    "Create board",
    "Delete board",
    "Project goal",
    "Audience",
    "Constraints",
    "Unresolved questions",
    "Add question",
    "Decision rationale",
    "Undecided",
    "Selected",
    "Rejected",
    "Research note",
    "BoardExportControls",
    "Remove",
  ]) {
    assert.match(experience, new RegExp(phrase));
  }
  assert.doesNotMatch(experience, /Sync to cloud/i);
});

test("Board export is labelled, local-only, and validation-aware", async () => {
  const controls = await read(
    "components/project-boards/board-export-controls.tsx",
  );
  for (const phrase of [
    "Export research pack",
    "Generated date",
    "Copy Markdown",
    "Download .md",
    "Copy JSON",
    "Download .json",
    "Complete these requirements before exporting",
  ]) {
    assert.match(controls, new RegExp(phrase.replaceAll(".", "\\."), "i"));
  }
  assert.match(
    controls,
    /Board content stays in this\s+browser and is not uploaded/i,
  );
  assert.match(controls, /aria-live="polite"/);
  assert.match(controls, /disabled={!result\.ok}/);
  assert.match(controls, /createBoardAgentHandoff/);
  assert.match(controls, /navigator\.clipboard\.writeText\(handoff\.json\)/);
  assert.match(controls, /new Blob\(\[handoff\.json\]/);
  assert.match(controls, /explicitly paste\s+or\s+attach it to the agent/i);
  assert.match(
    controls,
    /local MCP do not read this\s+browser Board automatically/i,
  );
  assert.match(controls, /\{handoff\.ok \? \(/);
});

test("boards route uses canonical source profiles and remains local-navigation only", async () => {
  const page = await read("app/boards/page.tsx");
  const saved = await read("app/saved/page.tsx");
  const sitemap = await read("app/sitemap.ts");
  assert.match(page, /getAllSourceProfiles/);
  assert.match(page, /profileLevel: profile\.profileLevel/);
  assert.match(page, /ProjectBoardsExperience/);
  assert.match(saved, /href="\/boards"/);
  assert.doesNotMatch(sitemap, /"\/boards"/);
});
