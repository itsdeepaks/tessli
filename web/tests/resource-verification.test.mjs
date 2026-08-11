import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import {
  RESOURCE_VERIFICATION_CONTRACT,
  ResourceVerificationError,
  createResourceVerificationDraft,
  stableJson,
  validateResourceVerificationRecord,
} from "../lib/resource-verification.ts";
import { getSourceCoverageCounts } from "../lib/source-profiles.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const cliPath = path.join(webRoot, "scripts/resource-verification.mjs");
const schemaPath = path.join(
  __dirname,
  "../../schemas/resource-verification-record.schema.json",
);

function structuredCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function validIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function validUri(value) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

function compileVerificationSchema() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  return new Ajv2020({
    allErrors: true,
    strict: false,
    formats: {
      date: validIsoDate,
      uri: validUri,
    },
  }).compile(schema);
}

function completeRecord(draft, decision) {
  const record = structuredCloneJson(draft);
  record.status = "completed";
  record.completedAt = "2026-08-06";
  record.availabilityCheck = {
    ...record.availabilityCheck,
    result: decision === "verified" ? "passed" : "unknown",
    method: "manual-browser",
    checkedAt: "2026-08-06",
    notes: "Canonical destination reviewed manually.",
  };
  record.claimChecks = record.claimChecks.map((check) => ({
    ...check,
    result: decision === "verified" ? "confirmed" : "uncertain",
    method: "document-review",
    checkedAt: "2026-08-06",
    notes: "Official evidence reviewed.",
  }));
  record.interfaceChecks = record.interfaceChecks.map((check) => ({
    ...check,
    result: decision === "verified" ? "passed" : "unknown",
    method: "manual-api-test",
    checkedAt: "2026-08-06",
    notes: "Interface reviewed without recording credentials.",
  }));
  record.governanceCheck = {
    persistence: decision === "verified" ? "confirmed" : "uncertain",
    redistribution: decision === "verified" ? "confirmed" : "uncertain",
    attribution: decision === "verified" ? "confirmed" : "uncertain",
    terms: decision === "verified" ? "confirmed" : "uncertain",
    termsUrl: "https://developers.google.com/fonts/faq/privacy",
    checkedAt: "2026-08-06",
    notes: "Current official governance material reviewed.",
  };
  record.limitationsReviewed = true;
  record.freshness = {
    status: decision === "verified" ? "current" : "aging",
    recheckBy: "2026-11-04",
  };
  record.decision = decision;
  record.decisionNotes =
    decision === "verified"
      ? "All required checks passed for later promotion review."
      : "Material uncertainty remains; do not promote.";
  return record;
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: webRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
  });
}

test("verification schema fixes the public v1 record shape", () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(
    schema.$id,
    "https://tessli.dev/schemas/resource-verification-record.schema.json",
  );
  assert.equal(
    schema.properties.contract.const,
    RESOURCE_VERIFICATION_CONTRACT,
  );
  assert.equal(schema.properties.recordVersion.const, 1);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.reviewer.properties.type.const, "human-operator");
  assert.deepEqual(schema.properties.decision.enum, [
    "pending",
    "verified",
    "needs-review",
    "rejected",
  ]);
  assert.ok(Array.isArray(schema.allOf));
});

test("draft generation is deterministic and bound to canonical profile evidence", () => {
  const input = {
    identifier: "google-fonts",
    reviewerId: "operator-1",
    reviewerDisplayName: "Operator One",
    startedAt: "2026-08-06",
  };
  const first = createResourceVerificationDraft(input);
  const second = createResourceVerificationDraft(input);

  assert.deepEqual(first, second);
  assert.equal(stableJson(first), stableJson(second));
  assert.equal(first.contract, RESOURCE_VERIFICATION_CONTRACT);
  assert.equal(first.resourceId, "resource-75ecf91b7063");
  assert.equal(first.resourceSlug, "google-fonts");
  assert.match(first.profileSha256, /^[a-f0-9]{64}$/u);
  assert.equal(first.profileReviewedAt, "2026-08-05");
  assert.equal(first.status, "draft");
  assert.equal(first.completedAt, null);
  assert.equal(first.decision, "pending");
  assert.equal(first.claimChecks.length, 2);
  assert.equal(first.interfaceChecks.length, 1);
  assert.equal(
    first.interfaceChecks[0].credentialHandling,
    "user-owned-not-recorded",
  );
  assert.match(stableJson(first), /\n$/u);
});

test("draft and completed records satisfy Draft 2020-12 JSON Schema", () => {
  const validate = compileVerificationSchema();
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });
  assert.equal(validate(draft), true, JSON.stringify(validate.errors, null, 2));

  const needsReview = completeRecord(draft, "needs-review");
  assert.equal(
    validate(needsReview),
    true,
    JSON.stringify(validate.errors, null, 2),
  );

  const verified = completeRecord(draft, "verified");
  assert.equal(
    validate(verified),
    true,
    JSON.stringify(validate.errors, null, 2),
  );
});

test("schema rejects impossible dates, unsafe verified shapes, and extra fields", () => {
  const validate = compileVerificationSchema();
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });

  const impossibleDate = structuredCloneJson(draft);
  impossibleDate.startedAt = "2026-02-31";
  assert.equal(validate(impossibleDate), false);

  const unsafeVerified = completeRecord(draft, "verified");
  unsafeVerified.governanceCheck.termsUrl = null;
  assert.equal(validate(unsafeVerified), false);

  const secretBearing = structuredCloneJson(draft);
  secretBearing.credentials = "must-not-be-stored";
  assert.equal(validate(secretBearing), false);
});

test("draft generation rejects unknown, Listed-only, invalid reviewer, and impossible dates", () => {
  assert.throws(
    () =>
      createResourceVerificationDraft({
        identifier: "missing-source",
        reviewerId: "operator-1",
        startedAt: "2026-08-06",
      }),
    ResourceVerificationError,
  );
  assert.throws(
    () =>
      createResourceVerificationDraft({
        identifier: "awwwards",
        reviewerId: "operator-1",
        startedAt: "2026-08-06",
      }),
    /Listed only/u,
  );
  assert.throws(
    () =>
      createResourceVerificationDraft({
        identifier: "google-fonts",
        reviewerId: " ",
        startedAt: "2026-08-06",
      }),
    /reviewerId/u,
  );
  assert.throws(
    () =>
      createResourceVerificationDraft({
        identifier: "google-fonts",
        reviewerId: "operator-1",
        startedAt: "2026-02-31",
      }),
    /valid ISO date/u,
  );
});

test("stale fingerprints and incomplete completed records fail safely", () => {
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });
  const stale = structuredCloneJson(draft);
  stale.profileSha256 = "0".repeat(64);
  assert.match(
    validateResourceVerificationRecord(stale).errors.join(" "),
    /profileSha256 is stale/u,
  );

  const incomplete = structuredCloneJson(draft);
  incomplete.status = "completed";
  incomplete.completedAt = "2026-08-06";
  incomplete.decision = "verified";
  const result = validateResourceVerificationRecord(incomplete);
  assert.equal(result.valid, false);
  assert.equal(result.eligibleForPromotion, false);
  assert.match(result.errors.join(" "), /availability/u);
  assert.match(result.errors.join(" "), /claimChecks\[0\].*pending/u);
  assert.match(result.errors.join(" "), /decisionNotes/u);
});

test("completed records reject invalid chronology and unperformed checks", () => {
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });
  const record = completeRecord(draft, "needs-review");
  record.availabilityCheck.checkedAt = "2026-08-05";
  record.claimChecks[0].method = "not-run";
  record.interfaceChecks[0].checkedAt = "2026-02-31";
  record.freshness.recheckBy = "2026-08-05";

  const result = validateResourceVerificationRecord(record);
  assert.equal(result.valid, false);
  assert.equal(result.eligibleForPromotion, false);
  assert.match(
    result.errors.join(" "),
    /availabilityCheck\.checkedAt cannot be earlier/u,
  );
  assert.match(
    result.errors.join(" "),
    /claimChecks\[0\] requires a review method/u,
  );
  assert.match(
    result.errors.join(" "),
    /interfaceChecks\[0\]\.checkedAt must be a valid ISO date/u,
  );
  assert.match(
    result.errors.join(" "),
    /freshness\.recheckBy cannot be earlier/u,
  );
});

test("records cannot begin before the exact canonical profile was reviewed", () => {
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });
  draft.startedAt = "2026-08-04";

  const result = validateResourceVerificationRecord(draft);
  assert.equal(result.valid, false);
  assert.equal(result.eligibleForPromotion, false);
  assert.match(result.errors.join(" "), /earlier than profileReviewedAt/u);
});

test("completed needs-review records are valid but never promotion eligible", () => {
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });
  const record = completeRecord(draft, "needs-review");
  const result = validateResourceVerificationRecord(record);
  assert.deepEqual(result, {
    valid: true,
    eligibleForPromotion: false,
    errors: [],
  });
});

test("only a complete verified record becomes eligible for later promotion", () => {
  const draft = createResourceVerificationDraft({
    identifier: "google-fonts",
    reviewerId: "operator-1",
    startedAt: "2026-08-06",
  });
  const record = completeRecord(draft, "verified");
  assert.deepEqual(validateResourceVerificationRecord(record), {
    valid: true,
    eligibleForPromotion: true,
    errors: [],
  });

  const contradicted = structuredCloneJson(record);
  contradicted.claimChecks[0].result = "contradicted";
  const result = validateResourceVerificationRecord(contradicted);
  assert.equal(result.valid, false);
  assert.equal(result.eligibleForPromotion, false);
  assert.match(result.errors.join(" "), /every claim/u);

  const missingTerms = structuredCloneJson(record);
  missingTerms.governanceCheck.termsUrl = null;
  assert.match(
    validateResourceVerificationRecord(missingTerms).errors.join(" "),
    /termsUrl/u,
  );

  const documentationOnlyApi = structuredCloneJson(record);
  documentationOnlyApi.interfaceChecks[0].method = "document-review";
  const documentationOnlyResult =
    validateResourceVerificationRecord(documentationOnlyApi);
  assert.equal(documentationOnlyResult.eligibleForPromotion, false);
  assert.match(
    documentationOnlyResult.errors.join(" "),
    /requires manual-api-test/u,
  );

  const documentationOnlyAvailability = structuredCloneJson(record);
  documentationOnlyAvailability.availabilityCheck.method = "document-review";
  assert.match(
    validateResourceVerificationRecord(
      documentationOnlyAvailability,
    ).errors.join(" "),
    /manual-browser/u,
  );

  const expiredResult = validateResourceVerificationRecord(record, {
    asOfDate: "2026-11-05",
  });
  assert.equal(expiredResult.eligibleForPromotion, false);
  assert.match(expiredResult.errors.join(" "), /recheckBy is stale/u);
});

test("CLI drafts and checks temporary draft, needs-review, and verified records", () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tessli-resource-verification-"),
  );
  const draftPath = path.join(tempRoot, "google-fonts-draft.json");
  const needsReviewPath = path.join(tempRoot, "google-fonts-needs-review.json");
  const verifiedPath = path.join(tempRoot, "google-fonts-verified.json");
  const secret = "must-not-leak-from-environment";

  try {
    const draftResult = runCli(
      [
        "draft",
        "google-fonts",
        "--reviewer",
        "operator-1",
        "--date",
        "2026-08-06",
        "--output",
        draftPath,
      ],
      {
        env: {
          ...process.env,
          TESSLI_TEST_SECRET: secret,
          TESSLI_TEST_COOKIE: secret,
        },
      },
    );
    assert.equal(draftResult.status, 0, draftResult.stderr);
    assert.equal(fs.existsSync(draftPath), true);
    assert.doesNotMatch(
      fs.readFileSync(draftPath, "utf8"),
      new RegExp(secret, "u"),
    );

    const draftCheck = runCli(["check", draftPath]);
    assert.equal(draftCheck.status, 0, draftCheck.stderr);
    assert.deepEqual(JSON.parse(draftCheck.stdout), {
      decision: "pending",
      eligibleForPromotion: false,
      errors: [],
      resourceId: "resource-75ecf91b7063",
      resourceSlug: "google-fonts",
      status: "draft",
      valid: true,
    });

    const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
    fs.writeFileSync(
      needsReviewPath,
      stableJson(completeRecord(draft, "needs-review")),
      "utf8",
    );
    const needsReviewCheck = runCli(["check", needsReviewPath]);
    assert.equal(needsReviewCheck.status, 0, needsReviewCheck.stderr);
    assert.equal(JSON.parse(needsReviewCheck.stdout).valid, true);
    assert.equal(
      JSON.parse(needsReviewCheck.stdout).eligibleForPromotion,
      false,
    );

    fs.writeFileSync(
      verifiedPath,
      stableJson(completeRecord(draft, "verified")),
      "utf8",
    );
    const verifiedCheck = runCli(["check", verifiedPath]);
    assert.equal(verifiedCheck.status, 0, verifiedCheck.stderr);
    assert.equal(JSON.parse(verifiedCheck.stdout).valid, true);
    assert.equal(JSON.parse(verifiedCheck.stdout).eligibleForPromotion, true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("CLI rejects unknown options, duplicate options, and invalid completed records", () => {
  const unknown = runCli([
    "draft",
    "google-fonts",
    "--reviewer",
    "operator-1",
    "--date",
    "2026-08-06",
    "--token",
    "secret",
  ]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown option: --token/u);

  const duplicate = runCli([
    "draft",
    "google-fonts",
    "--reviewer",
    "operator-1",
    "--reviewer",
    "operator-2",
    "--date",
    "2026-08-06",
  ]);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /may only be supplied once/u);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tessli-invalid-"));
  const recordPath = path.join(tempRoot, "invalid.json");
  try {
    const draft = createResourceVerificationDraft({
      identifier: "google-fonts",
      reviewerId: "operator-1",
      startedAt: "2026-08-06",
    });
    const record = completeRecord(draft, "verified");
    record.claimChecks[0].result = "contradicted";
    fs.writeFileSync(recordPath, stableJson(record), "utf8");

    const result = runCli(["check", recordPath]);
    assert.notEqual(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, false);
    assert.equal(output.eligibleForPromotion, false);
    assert.match(
      output.errors.join(" "),
      /claimChecks\/0\/result|every claim/u,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Slice 1.5 leaves canonical coverage unchanged", () => {
  assert.deepEqual(getSourceCoverageCounts(), {
    listed: 255,
    profiled: 40,
    verified: 0,
  });
});
