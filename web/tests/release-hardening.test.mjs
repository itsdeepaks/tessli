import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(currentFile), "..");
const repositoryRoot = path.resolve(webRoot, "..");

async function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function tableRow(...cells) {
  return new RegExp(
    `\\|\\s*${cells
      .map((cell) => cell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s*\\|\\s*")}\\s*\\|`,
  );
}

test("release history remains preserved while V3 drives active execution", async () => {
  const slices = await readRepositoryFile("build-slices.md");
  const plan = await readRepositoryFile("docs/product-plan-v2.md");
  const readme = await readRepositoryFile("README.md");
  const cutover = await readRepositoryFile(
    "docs/slices/9.3-production-replacement.md",
  );

  assert.match(
    slices,
    /previous detailed Phase 1 ledger and legacy slice numbers remain available in Git history/i,
  );
  assert.match(
    slices,
    tableRow(
      "0.1",
      "Product direction and operating reset",
      "DONE",
      "previous baseline",
      "legacy `14.0`, PR #74",
    ),
  );
  assert.match(
    slices,
    tableRow(
      "0.2",
      "Execution-track realignment",
      "DONE",
      "0.1",
      "`docs/slices/0.2-execution-track-realignment.md`, PR #95",
    ),
  );
  assert.match(
    slices,
    tableRow(
      "1.1",
      "Canonical source-profile contract",
      "DONE",
      "0.1",
      "legacy `14.1`",
    ),
  );
  for (const row of [
    [
      "1.3",
      "Priority source profile expansion — Batch 1",
      "DONE",
      "0.2, 1.2",
      "`docs/slices/1.3-priority-source-profile-expansion-batch-1.md`, PR #96",
    ],
    [
      "1.4",
      "Priority source profile expansion — Batch 2",
      "DONE",
      "1.3",
      "`docs/slices/1.4-priority-source-profile-expansion-batch-2.md`, PR #97",
    ],
    [
      "1.5",
      "Verification contract and operator workflow",
      "DONE",
      "1.4",
      "`docs/slices/1.5-verification-contract-operator-workflow.md`, PR #98",
    ],
    ["1.6", "First evidence-backed Verified batch", "NEXT", "1.5", "—"],
  ]) {
    assert.match(slices, tableRow(...row));
  }
  assert.match(
    slices,
    tableRow(
      "2.1",
      "Canonical Browse architecture and pagination contract",
      "DONE",
      "1.2",
      "legacy `14.2`, PR #77",
    ),
  );
  for (const row of [
    [
      "2.2",
      "Canonical `/resources` implementation",
      "DONE",
      "2.1",
      "`docs/slices/2.2-canonical-browse-implementation.md`, PR #79",
    ],
    [
      "2.3",
      "Source Detail foundation for all 295 sources",
      "DONE",
      "1.2, 2.2",
      "`docs/slices/2.3-source-detail-foundation.md`, PR #80",
    ],
    [
      "2.4",
      "Enriched intelligence detail and Similar Sources",
      "DONE",
      "2.3",
      "`docs/slices/2.4-enriched-intelligence-detail.md`, PR #81",
    ],
    [
      "3.1",
      "Universal browser-local Save",
      "DONE",
      "2.2, 2.3",
      "`docs/slices/3.1-universal-local-save.md`, PR #82",
    ],
    [
      "3.2",
      "Saved workspace search/filter refinement",
      "DONE",
      "3.1",
      "`docs/slices/3.2-saved-workspace-refinement.md`, PR #83",
    ],
    [
      "3.3",
      "Local project Boards and notes",
      "DONE",
      "3.1, 3.2",
      "`docs/slices/3.3-local-project-boards.md`, PR #84",
    ],
    [
      "3.4",
      "Selected/rejected decisions and unresolved questions",
      "DONE",
      "3.3",
      "`docs/slices/3.4-board-decisions.md`, PR #85",
    ],
    [
      "4.1",
      "Board research-pack contract",
      "DONE",
      "3.4",
      "`docs/research-pack-contract.md`, PR #86",
    ],
    [
      "4.2",
      "Deterministic Markdown export",
      "DONE",
      "4.1",
      "`docs/slices/4.2-deterministic-markdown-export.md`, PR #87",
    ],
    [
      "4.3",
      "Safe public machine-readable representations",
      "DONE",
      "2.4, 4.2",
      "`docs/slices/4.3-public-machine-readable-representations.md`, PR #88",
    ],
    [
      "5.1",
      "OSS proof brief and research Board",
      "DONE",
      "4.3",
      "`docs/slices/5.1-oss-proof-research-setup.md`, PR #89",
    ],
    [
      "5.2",
      "Agent implementation from exported pack",
      "DONE",
      "5.1",
      "`docs/slices/5.2-oss-homepage-candidate.md`, PR #90",
    ],
    [
      "5.3",
      "Browser and human review",
      "BLOCKED",
      "5.2",
      "`docs/slices/5.3-oss-homepage-human-review.md`, PR #91",
    ],
    ["5.4", "Outcome/evidence report", "BLOCKED", "5.3 human artifact", "—"],
    [
      "6.1",
      "Global navigation and naming cleanup",
      "DONE",
      "2.2",
      "`docs/slices/6.1-global-navigation-cleanup.md`, PR #92",
    ],
    [
      "6.2",
      "Curated homepage built around proven workflow",
      "BLOCKED",
      "5.4, 6.1",
      "—",
    ],
    [
      "6.3",
      "Collections-to-playbooks conversion",
      "DONE",
      "3.3, 4.2",
      "`docs/slices/6.3-collections-to-playbooks.md`, PR #93",
    ],
    [
      "6.4",
      "For AI product page",
      "DONE",
      "2.4, 4.3",
      "`docs/slices/6.4-for-ai-product-page.md`, PR #94",
    ],
  ]) {
    assert.match(slices, tableRow(...row));
  }
  assert.match(
    slices,
    /Status: \*\*active delivery plan — V3\.4 Canonical Browse focus NEXT\*\*/,
  );
  assert.match(
    slices,
    tableRow("V3.0", "Authority reconciliation", "DONE", "V3 approval"),
  );
  assert.match(slices, tableRow("V3.1", "Public IA hygiene", "DONE", "V3.0"));
  assert.match(
    slices,
    tableRow("V3.2", "AccessRoute contract pilot", "DONE", "V3.0"),
  );
  assert.match(
    slices,
    tableRow("V3.3", "Source guide vertical proof", "DONE", "V3.2"),
  );
  assert.match(
    slices,
    tableRow("V3.4", "Canonical Browse focus", "NEXT", "V3.2, V3.3"),
  );
  assert.match(slices, /## 7\. Historical V2 phase status/);
  assert.match(
    plan,
    /Status: \*\*historical V2 execution record — superseded for new work by V3\.0\*\*/,
  );
  assert.match(
    plan,
    /V3\.0 makes `docs\/product-realignment-v3\.md` and the reconciled `build-slices\.md` authoritative for all new work\./,
  );
  assert.match(
    plan,
    /Historical status: \*\*NEXT before V3\.0; not an active V3 slice\*\*/,
  );
  assert.match(plan, /Phase 10 — Evidence-Backed UI-Taste Layer/i);
  assert.match(
    plan,
    /## 6\. Phase 2 — Browse and Source Detail\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /## 7\. Phase 3 — Local Saved and Project Boards\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /## 8\. Phase 4 — Research-Pack Export\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /### 4\.2 Deterministic Markdown export\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /### 4\.3 Safe public machine-readable representations\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /## 9\. Phase 5 — Real OSS Proof Project\n\nStatus: \*\*BLOCKED — GENUINE HUMAN REVIEW REQUIRED\*\*/,
  );
  assert.match(plan, /### 5\.1 Research setup\n\nStatus: \*\*DONE\*\*/);
  assert.match(plan, /### 5\.2 Agent implementation\n\nStatus: \*\*DONE\*\*/);
  assert.match(
    plan,
    /### 5\.3 Browser and human review\n\nStatus: \*\*BLOCKED — SAFE REVIEW SETUP COMPLETE\*\*/,
  );
  assert.match(
    plan,
    /### 5\.4 Outcome report\n\nStatus: \*\*BLOCKED — REQUIRES COMPLETED 5\.3 HUMAN ARTIFACT\*\*/,
  );
  assert.match(
    plan,
    /### 6\.1 Global navigation and naming\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /### 6\.2 Curated homepage\n\nStatus: \*\*BLOCKED — REQUIRES COMPLETED PHASE 5 OUTCOME\*\*/,
  );
  assert.match(
    plan,
    /### 6\.3 Collections become playbooks\n\nStatus: \*\*DONE\*\*/,
  );
  assert.match(
    plan,
    /## 10\. Phase 6 — Homepage, Navigation, Playbooks, and For AI\n\nStatus: \*\*BLOCKED — CURATED HOMEPAGE REQUIRES COMPLETED PHASE 5 OUTCOME\*\*/,
  );
  assert.match(plan, /### 6\.4 For AI\n\nStatus: \*\*DONE\*\*/);
  assert.match(
    plan,
    /## 11\. Phase 7 — Reviewed Pattern Candidates\n\nStatus: \*\*BLOCKED — REQUIRES COMPLETED PHASE 5 OUTCOME\*\*/,
  );
  assert.match(
    slices,
    /ten selected references, four rejected directions, a deterministic `tessli\.board-research-pack\.v1` handoff/i,
  );
  assert.match(
    slices,
    /V3\.0 replaced this continuation boundary\. The next repository slice is \*\*V3\.4 Canonical Browse focus\*\*/,
  );
  assert.match(slices, /Proof and UI Judgment:.*Slice 5\.3 remains BLOCKED/is);
  assert.match(
    readme,
    /V3\.0 authority reconciliation, V3\.1 public IA hygiene, V3\.2 AccessRoute pilot, and V3\.3 Motion source-guide proof are complete\./,
  );
  assert.match(
    readme,
    /next independently reviewable slice is \*\*V3\.4 — Canonical Browse focus\*\*/i,
  );
  assert.match(
    slices,
    /35,079-character handoff.*five-viewport screenshot checks/is,
  );
  assert.match(cutover, /dpl_6fj2gzYhAEDahEbeQZvVrTneejy9/);
  assert.match(cutover, /dpl_CQXFJvSFdnXGkEsswdGQv38NhymS/);
  assert.match(cutover, /no grouped runtime errors/i);
});

test("release workflow covers the locked checks and formal viewport set", async () => {
  const workflow = await readRepositoryFile(
    ".github/workflows/phase-1-release-gate.yml",
  );
  const browser = await readRepositoryFile(
    "web/tests/release-gate-browser.mjs",
  );

  for (const command of [
    "npm ci",
    "npm run format:check",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run catalogue:check",
    "npm run build",
  ]) {
    assert.match(
      workflow,
      new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  for (const viewport of [
    "1440, 900",
    "1280, 800",
    "1024, 768",
    "768, 1024",
    "430, 932",
    "390, 844",
    "360, 800",
  ]) {
    assert.match(browser, new RegExp(viewport));
  }

  for (const route of [
    "/collections",
    "/resources",
    "/saved",
    "/boards",
    "/about",
    "/curation",
    "/privacy",
    "/terms",
    "/content-policy",
    "/submit",
    "/suggest",
    "/a-clearly-missing-route",
  ]) {
    assert.match(browser, new RegExp(route.replaceAll("/", "\\/")));
  }

  assert.match(browser, /data-saved-resources-empty/);
  assert.match(browser, /board-export-title/);
  assert.match(browser, /tessli-project-boards-v1/);
  assert.match(browser, /scrollWidth > document\.documentElement\.clientWidth/);
  assert.match(workflow, /tessli-phase-1-release-evidence/);
});

test("release note and README preserve evidence and rollback boundaries", async () => {
  const note = await readRepositoryFile(
    "docs/slices/9.2-phase-1-release-hardening.md",
  );
  const readme = await readRepositoryFile("README.md");

  for (const heading of [
    "Acceptance criteria",
    "Exclusions",
    "Release evidence",
    "Production preconditions",
    "Rollback procedure",
  ]) {
    assert.match(note, new RegExp(`## ${heading}`));
  }

  assert.match(note, /does not change the production deployment target/i);
  assert.match(note, /previous known-good deployment/i);
  assert.match(readme, /Current application baseline/i);
  assert.match(readme, /web\/package\.json/i);
  assert.match(
    readme,
    /previous repository-root static production deployment/i,
  );
  assert.match(readme, /rollback target/i);
  assert.match(
    readme,
    /probe `\/`, `\/collections`, `\/resources`, `\/saved`, `\/about`/i,
  );
});
