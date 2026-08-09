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

test("Saved page provides a local, searchable workspace with reversible changes", async () => {
  const [experience, styles] = await Promise.all([
    read("components/saved-resources/saved-resources-experience.tsx"),
    read("components/saved-resources/saved-resources.module.css"),
  ]);

  assert.match(experience, /^"use client";/);
  assert.match(experience, /readSavedResourceIds\(resources\)/);
  assert.match(experience, /writeSavedResourceIds\(\[\]\)/);
  assert.match(experience, /\.slice\(\)\s*\.reverse\(\)/);
  assert.match(experience, /normalizedSearchText/);
  assert.match(experience, /data-saved-search/);
  assert.match(experience, /data-saved-category/);
  assert.match(experience, /data-saved-access/);
  assert.match(experience, /data-saved-sort/);
  assert.match(experience, /data-saved-reset/);
  assert.match(experience, /data-saved-filtered-empty/);
  assert.match(experience, /data-saved-resources-empty/);
  assert.match(experience, /data-clear-saved/);
  assert.match(experience, /data-confirm-clear-saved/);
  assert.match(experience, /data-undo-clear-saved/);
  assert.match(experience, /onUndo: \(\) => restoreResource/);
  assert.match(experience, /setSavedResourceIds\(\(currentIds\) =>/);
  assert.match(
    experience,
    /new Set\(\[\.\.\.resourceIds, \.\.\.currentIds\]\)/,
  );
  assert.match(experience, /href="\/resources"/);
  assert.match(experience, /<dialog/);
  assert.match(experience, /event\.preventDefault\(\)/);
  assert.match(experience, /event\.key === "Escape"/);
  assert.match(experience, /clearTriggerRef\.current\?\.focus\(\)/);
  assert.match(experience, /<ToastNotification/);
  assert.match(experience, /aria-live="polite"/);
  assert.doesNotMatch(
    experience,
    /fetch\(|sessionStorage|sign in|supabase|cloud/i,
  );

  assert.match(styles, /\.workspace/);
  assert.match(styles, /grid-template-columns: repeat\(4/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /gap: 1px/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /backdrop-filter|border-radius: 1[2-9]px/);
});

test("Toast notification component is accessible and un-opinionated", async () => {
  const [toastComponent, toastStyles] = await Promise.all([
    read("components/toast-notification/toast-notification.tsx"),
    read("components/toast-notification/toast-notification.module.css"),
  ]);

  assert.match(toastComponent, /aria-live="polite"/);
  assert.match(toastComponent, /data-toast-container="true"/);
  assert.match(toastComponent, /data-toast-undo="true"/);
  assert.match(toastStyles, /\.container/);
  assert.match(toastStyles, /\.toast/);
  assert.match(toastStyles, /\.undoButton/);
});
