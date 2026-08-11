import assert from "node:assert/strict";
import test from "node:test";

import { createResourceVerificationDraft } from "../lib/resource-verification.ts";
import {
  VERIFICATION_PROMOTION_REQUEST_CONTRACT,
  buildVerifiedPromotionRegistry,
} from "../lib/verification-promotions.ts";

function request(resourceIds = []) {
  return {
    contract: VERIFICATION_PROMOTION_REQUEST_CONTRACT,
    version: 1,
    resourceIds,
  };
}

function completedRadixRecord(decision = "verified") {
  const draft = createResourceVerificationDraft({
    identifier: "radix-ui",
    reviewerId: "human-reviewer",
    reviewerDisplayName: "Human Reviewer",
    startedAt: "2026-08-06",
  });

  return {
    ...draft,
    status: "completed",
    completedAt: "2026-08-06",
    availabilityCheck: {
      ...draft.availabilityCheck,
      result: "passed",
      method: "manual-browser",
      checkedAt: "2026-08-06",
      notes: "Canonical destination and official documentation reviewed.",
    },
    claimChecks: draft.claimChecks.map((claim) => ({
      ...claim,
      result: "confirmed",
      method: "document-review",
      checkedAt: "2026-08-06",
      notes: "Confirmed against the linked official documentation.",
    })),
    governanceCheck: {
      persistence: "confirmed",
      redistribution: "confirmed",
      attribution: "confirmed",
      terms: "confirmed",
      termsUrl: "https://github.com/radix-ui/primitives/blob/main/LICENSE",
      checkedAt: "2026-08-06",
      notes:
        "MIT licence reviewed; copyright and permission notice must be retained.",
    },
    limitationsReviewed: true,
    freshness: {
      status: "current",
      recheckBy: "2026-11-04",
    },
    decision,
    decisionNotes:
      decision === "verified"
        ? "Human operator confirmed current official evidence and governance boundaries."
        : "Human operator retained the record for further review.",
  };
}

function build({ resourceIds = [], records = [] } = {}) {
  return buildVerifiedPromotionRegistry({
    request: request(resourceIds),
    requestPath: "verification-records/promotions.json",
    requestSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    records,
  });
}

test("empty promotion request preserves an empty deterministic registry", () => {
  const result = build();

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.registry.recordCount, 0);
  assert.deepEqual(result.registry.promotions, []);
});

test("a valid completed record does not promote itself", () => {
  const result = build({
    records: [
      {
        path: "verification-records/1.6/radix-ui.json",
        record: completedRadixRecord(),
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.equal(result.registry.recordCount, 1);
  assert.deepEqual(result.registry.promotions, []);
});

test("an explicitly requested eligible record produces one promotion", () => {
  const record = completedRadixRecord();
  const result = build({
    resourceIds: [record.resourceId],
    records: [
      {
        path: "verification-records/1.6/radix-ui.json",
        record,
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.equal(result.registry.promotions.length, 1);
  assert.deepEqual(result.registry.promotions[0], {
    resourceId: record.resourceId,
    resourceSlug: "radix-ui",
    recordPath: "verification-records/1.6/radix-ui.json",
    profileSha256: record.profileSha256,
    completedAt: "2026-08-06",
    reviewerId: "human-reviewer",
    recheckBy: "2026-11-04",
  });
});

test("a promotion request fails when its completed record is missing", () => {
  const result = build({ resourceIds: ["resource-01db82f90e23"] });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /no completed repository record/u);
});

test("a needs-review record cannot be promoted", () => {
  const record = completedRadixRecord("needs-review");
  const result = build({
    resourceIds: [record.resourceId],
    records: [
      {
        path: "verification-records/1.6/radix-ui.json",
        record,
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /not eligible for promotion/u);
});

test("duplicate promotion IDs and duplicate records are rejected", () => {
  const record = completedRadixRecord();
  const result = build({
    resourceIds: [record.resourceId, record.resourceId],
    records: [
      { path: "verification-records/1.6/radix-ui.json", record },
      { path: "verification-records/1.6/radix-ui-copy.json", record },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate promotion request/u);
  assert.match(result.errors.join(" "), /Duplicate verification record/u);
});

test("malformed or out-of-batch promotion requests are rejected", () => {
  const malformed = buildVerifiedPromotionRegistry({
    request: {
      ...request([" resource-01db82f90e23 "]),
      unexpected: true,
    },
    requestPath: "verification-records/promotions.json",
    requestSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    records: [],
  });
  assert.equal(malformed.valid, false);
  assert.match(malformed.errors.join(" "), /contain exactly/u);
  assert.match(malformed.errors.join(" "), /whitespace padding/u);

  const outOfBatch = build({ resourceIds: ["resource-000000000000"] });
  assert.equal(outOfBatch.valid, false);
  assert.match(outOfBatch.errors.join(" "), /Slice 1\.6 promotion requests/u);
});

test("completed records must use the canonical Slice 1.6 path", () => {
  const record = completedRadixRecord();
  const result = build({
    records: [
      {
        path: "verification-records/drafts/../radix-ui.json",
        record,
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /canonical completed-record path/u);
});
