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

test("Saved resources retain their shortlist controls while offering a local Add to Board intake", async () => {
  const [saved, intake] = await Promise.all([
    read("components/saved-resources/saved-resources-experience.tsx"),
    read("components/board-intake/board-intake.tsx"),
  ]);

  for (const contract of [
    /data-saved-search/,
    /data-saved-category/,
    /data-saved-access/,
    /data-saved-sort/,
    /data-saved-reset/,
    /data-clear-saved/,
    /data-undo-clear-saved/,
    /data-saved-filtered-empty/,
    /data-saved-resources-empty/,
    /BoardIntake/,
    /aria-live="polite"/,
  ]) {
    assert.match(saved, contract);
  }

  for (const contract of [
    /Add to Board/,
    /aria-haspopup="dialog"/,
    /<dialog/,
    /aria-labelledby=/,
    /Create Board and add source/,
    /boardName\.trim\(\)/,
    /if \(!name\)/,
    /Boards stay in this browser/,
    /not uploaded/i,
    /not[^.]*synced/i,
    /aria-live="polite"/,
  ]) {
    assert.match(intake, contract);
  }

  // The primary Saved surface remains a private local tool, not an account or
  // cloud-persistence promotion. The privacy statement above describes the
  // actual browser-only boundary without offering either deferred capability.
  assert.doesNotMatch(saved, /sign in|account|cloud/i);
});

test("the Board intake creates one blank undecided item and reports duplicate or storage outcomes", async () => {
  const intake = await read("components/board-intake/board-intake.tsx");

  for (const contract of [
    /item\.resourceId === resource\.id/,
    /function boardItem\(resourceId: string\)/,
    /resourceId,/,
    /note: ""/,
    /decision: "undecided" as const/,
    /rationale: ""/,
    /already on/i,
    /if \(!writeBoards\(next\)\)/,
    /could not save the Board/i,
    /aria-live="polite"/,
  ]) {
    assert.match(intake, contract);
  }

  // Existing-board selection appends only the requested source after the
  // duplicate guard; creation starts the new Board with that same one item.
  assert.match(
    intake,
    /items:\s*\[\s*\.\.\.current\.items,\s*boardItem\(resource\.id\)/s,
  );
  assert.match(intake, /items:\s*\[\s*boardItem\(resource\.id\)/s);
});

test("Saved and Source Detail compose the same labelled native Board dialog", async () => {
  const [saved, actions, intake] = await Promise.all([
    read("components/saved-resources/saved-resources-experience.tsx"),
    read("components/source-detail/source-actions.tsx"),
    read("components/board-intake/board-intake.tsx"),
  ]);

  for (const contract of [
    /Add to Board/,
    /aria-haspopup="dialog"/,
    /<dialog/,
    /aria-labelledby=/,
    /Boards stay in this browser/,
    /triggerRef\.current\?\.focus\(\)/,
  ]) {
    assert.match(intake, contract);
  }

  assert.match(saved, /<BoardIntake\s+resource=\{resource\}/s);
  assert.match(actions, /<BoardIntake\s+resource=\{resource\}/s);
});
