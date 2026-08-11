import type { ResourceVerificationRecord } from "./resource-verification.ts";
import { validateResourceVerificationRecord } from "./resource-verification.ts";

export const VERIFICATION_PROMOTION_REQUEST_CONTRACT =
  "tessli.resource-verification-promotions.v1" as const;
export const VERIFIED_PROMOTION_REGISTRY_CONTRACT =
  "tessli.verified-resource-promotions.v1" as const;
export const VERIFICATION_PROMOTION_VERSION = 1 as const;
export const SLICE_1_6_VERIFICATION_CANDIDATES = Object.freeze([
  {
    resourceId: "resource-75ecf91b7063",
    resourceSlug: "google-fonts",
  },
  {
    resourceId: "resource-01db82f90e23",
    resourceSlug: "radix-ui",
  },
  {
    resourceId: "resource-9ad947201ac6",
    resourceSlug: "react-aria",
  },
] as const);

export interface VerificationPromotionRequest {
  contract: typeof VERIFICATION_PROMOTION_REQUEST_CONTRACT;
  version: typeof VERIFICATION_PROMOTION_VERSION;
  resourceIds: string[];
}

export interface VerificationRecordEntry {
  path: string;
  record: ResourceVerificationRecord;
}

export interface VerifiedResourcePromotion {
  resourceId: string;
  resourceSlug: string;
  recordPath: string;
  profileSha256: string;
  completedAt: string;
  reviewerId: string;
  recheckBy: string;
}

export interface VerifiedPromotionRegistry {
  contract: typeof VERIFIED_PROMOTION_REGISTRY_CONTRACT;
  version: typeof VERIFICATION_PROMOTION_VERSION;
  source: {
    path: string;
    sha256: string;
  };
  recordCount: number;
  promotions: VerifiedResourcePromotion[];
}

export interface PromotionRegistryBuildResult {
  valid: boolean;
  errors: string[];
  registry: VerifiedPromotionRegistry;
}

function normalizedRecordPath(value: string): string {
  return value.replaceAll("\\", "/");
}

const slice16CandidateById = new Map<
  string,
  (typeof SLICE_1_6_VERIFICATION_CANDIDATES)[number]
>(
  SLICE_1_6_VERIFICATION_CANDIDATES.map((candidate) => [
    candidate.resourceId,
    candidate,
  ]),
);

function exactRequestShape(request: VerificationPromotionRequest): boolean {
  return (
    Object.keys(request).sort().join(",") === "contract,resourceIds,version"
  );
}

export function buildVerifiedPromotionRegistry(input: {
  request: VerificationPromotionRequest;
  requestPath: string;
  requestSha256: string;
  records: VerificationRecordEntry[];
}): PromotionRegistryBuildResult {
  const errors: string[] = [];
  const requestedIds = input.request.resourceIds.map((value) => value.trim());
  const requestPath = normalizedRecordPath(input.requestPath);

  if (!exactRequestShape(input.request)) {
    errors.push(
      "Promotion request must contain exactly contract, version, and resourceIds.",
    );
  }

  if (input.request.contract !== VERIFICATION_PROMOTION_REQUEST_CONTRACT) {
    errors.push(
      `Promotion request contract must be ${VERIFICATION_PROMOTION_REQUEST_CONTRACT}.`,
    );
  }
  if (input.request.version !== VERIFICATION_PROMOTION_VERSION) {
    errors.push(
      `Promotion request version must be ${VERIFICATION_PROMOTION_VERSION}.`,
    );
  }
  if (requestedIds.some((value) => !value)) {
    errors.push("Promotion request resource IDs cannot be blank.");
  }
  if (
    input.request.resourceIds.some(
      (value, index) => value !== requestedIds[index],
    )
  ) {
    errors.push(
      "Promotion request resource IDs cannot contain whitespace padding.",
    );
  }
  if (requestedIds.some((value) => !/^resource-[a-f0-9]{12}$/u.test(value))) {
    errors.push(
      "Promotion request resource IDs must use canonical resource IDs.",
    );
  }
  if (requestedIds.some((value) => !slice16CandidateById.has(value))) {
    errors.push(
      "Slice 1.6 promotion requests are limited to google-fonts, radix-ui, and react-aria.",
    );
  }
  if (requestPath !== "verification-records/promotions.json") {
    errors.push(
      "Promotion request path must be verification-records/promotions.json.",
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.requestSha256)) {
    errors.push(
      "Promotion request SHA-256 must be a lowercase 64-character digest.",
    );
  }

  const requestedSet = new Set<string>();
  for (const resourceId of requestedIds) {
    if (requestedSet.has(resourceId)) {
      errors.push(`Duplicate promotion request resource ID: ${resourceId}.`);
    }
    requestedSet.add(resourceId);
  }

  const recordsByResourceId = new Map<string, VerificationRecordEntry>();
  for (const entry of input.records) {
    const recordPath = normalizedRecordPath(entry.path);
    const resourceId = entry.record.resourceId;
    const semantic = validateResourceVerificationRecord(entry.record);
    const candidate = slice16CandidateById.get(resourceId);

    if (!semantic.valid) {
      errors.push(
        `${recordPath} is not a valid completed verification record: ${semantic.errors.join(" ")}`,
      );
    }
    if (entry.record.status !== "completed") {
      errors.push(
        `${recordPath} must be completed before repository retention.`,
      );
    }
    if (!candidate) {
      errors.push(
        `${recordPath} is outside the fixed Slice 1.6 candidate batch.`,
      );
    } else {
      const expectedPath = `verification-records/1.6/${candidate.resourceSlug}.json`;
      if (recordPath !== expectedPath) {
        errors.push(
          `${recordPath} must use the canonical completed-record path ${expectedPath}.`,
        );
      }
    }
    if (recordsByResourceId.has(resourceId)) {
      errors.push(
        `Duplicate verification record for resource ID: ${resourceId}.`,
      );
    } else {
      recordsByResourceId.set(resourceId, {
        path: recordPath,
        record: entry.record,
      });
    }
  }

  const promotions: VerifiedResourcePromotion[] = [];
  for (const resourceId of [...requestedSet].sort((left, right) =>
    left.localeCompare(right, "en"),
  )) {
    const entry = recordsByResourceId.get(resourceId);
    if (!entry) {
      errors.push(
        `Promotion request ${resourceId} has no completed repository record.`,
      );
      continue;
    }

    const semantic = validateResourceVerificationRecord(entry.record);
    if (!semantic.eligibleForPromotion) {
      errors.push(
        `Promotion request ${resourceId} is not eligible for promotion.`,
      );
      continue;
    }

    const { record } = entry;
    if (!record.completedAt || !record.freshness.recheckBy) {
      errors.push(
        `Promotion request ${resourceId} is missing completedAt or recheckBy.`,
      );
      continue;
    }

    promotions.push({
      resourceId: record.resourceId,
      resourceSlug: record.resourceSlug,
      recordPath: entry.path,
      profileSha256: record.profileSha256,
      completedAt: record.completedAt,
      reviewerId: record.reviewer.id,
      recheckBy: record.freshness.recheckBy,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    registry: {
      contract: VERIFIED_PROMOTION_REGISTRY_CONTRACT,
      version: VERIFICATION_PROMOTION_VERSION,
      source: {
        path: requestPath,
        sha256: input.requestSha256,
      },
      recordCount: input.records.length,
      promotions,
    },
  };
}
