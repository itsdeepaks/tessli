import { createHash } from "node:crypto";

import {
  getIntelligenceProfile,
  type ResourceIntelligenceProfile,
} from "./intelligence.ts";
import {
  SOURCE_PROFILE_REVIEWED_AT,
  getSourceProfile,
  type SourceProfile,
} from "./source-profiles.ts";

export const RESOURCE_VERIFICATION_CONTRACT =
  "tessli.resource-verification.v1" as const;
export const RESOURCE_VERIFICATION_RECORD_VERSION = 1 as const;

export class ResourceVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceVerificationError";
  }
}

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type VerificationAgentInterface =
  ResourceIntelligenceProfile["agentInterfaces"][number] & {
    authentication?: string;
    credentialOwner?: string;
    persistencePolicy?: string;
  };

export type VerificationDecision =
  "pending" | "verified" | "needs-review" | "rejected";

export interface ResourceVerificationRecord {
  contract: typeof RESOURCE_VERIFICATION_CONTRACT;
  recordVersion: typeof RESOURCE_VERIFICATION_RECORD_VERSION;
  resourceId: string;
  resourceSlug: string;
  profileSha256: string;
  profileReviewedAt: string;
  status: "draft" | "completed";
  startedAt: string;
  completedAt: string | null;
  reviewer: {
    type: "human-operator";
    id: string;
    displayName: string;
  };
  availabilityCheck: {
    result: "pending" | "passed" | "failed" | "unknown";
    method:
      | "not-run"
      | "document-review"
      | "manual-browser"
      | "manual-api-test"
      | "manual-cli-test";
    checkedAt: string | null;
    observedUrl: string;
    notes: string;
  };
  claimChecks: Array<{
    claim: string;
    sourceUrl: string;
    sourceType: string;
    result: "pending" | "confirmed" | "contradicted" | "uncertain";
    method:
      | "not-run"
      | "document-review"
      | "manual-browser"
      | "manual-api-test"
      | "manual-cli-test";
    checkedAt: string | null;
    notes: string;
  }>;
  interfaceChecks: Array<{
    type: string;
    transport: string;
    result: "pending" | "passed" | "failed" | "not-applicable" | "unknown";
    method:
      | "not-run"
      | "document-review"
      | "manual-browser"
      | "manual-api-test"
      | "manual-cli-test";
    checkedAt: string | null;
    credentialHandling:
      | "none-required"
      | "user-owned-not-recorded"
      | "workspace-owned-not-recorded"
      | "not-tested"
      | "unknown";
    persistencePolicy: string;
    notes: string;
  }>;
  governanceCheck: {
    persistence: "pending" | "confirmed" | "contradicted" | "uncertain";
    redistribution: "pending" | "confirmed" | "contradicted" | "uncertain";
    attribution: "pending" | "confirmed" | "contradicted" | "uncertain";
    terms: "pending" | "confirmed" | "contradicted" | "uncertain";
    termsUrl: string | null;
    checkedAt: string | null;
    notes: string;
  };
  limitationsReviewed: boolean;
  freshness: {
    status: "pending" | "current" | "aging" | "stale";
    recheckBy: string | null;
  };
  decision: VerificationDecision;
  decisionNotes: string;
}

export interface VerificationValidationResult {
  valid: boolean;
  eligibleForPromotion: boolean;
  errors: string[];
}

function stableJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, entry]) => [key, stableJsonValue(entry)]),
    );
  }
  throw new ResourceVerificationError(
    `Unsupported value in verification fingerprint: ${typeof value}.`,
  );
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(stableJsonValue(value), null, 2)}\n`;
}

export function intelligenceProfileSha256(
  profile: ResourceIntelligenceProfile,
): string {
  return createHash("sha256").update(stableJson(profile), "utf8").digest("hex");
}

function isoDateValue(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function requireIsoDate(value: string, field: string): string {
  if (isoDateValue(value) === null) {
    throw new ResourceVerificationError(`${field} must be a valid ISO date.`);
  }
  return value;
}

function verificationTarget(identifier: string): {
  source: SourceProfile;
  intelligence: ResourceIntelligenceProfile;
} {
  const source = getSourceProfile(identifier.trim());
  if (!source) {
    throw new ResourceVerificationError(
      `Unknown Tessli source identifier: ${identifier.trim() || "(blank)"}.`,
    );
  }
  const intelligence =
    getIntelligenceProfile(source.id) ?? getIntelligenceProfile(source.slug);
  if (!intelligence || source.profileLevel === "listed") {
    throw new ResourceVerificationError(
      `${source.name} is Listed only and cannot enter verification.`,
    );
  }
  return { source, intelligence };
}

function verificationInterface(
  profile: ResourceIntelligenceProfile["agentInterfaces"][number],
): VerificationAgentInterface {
  return profile as VerificationAgentInterface;
}

function credentialHandling(
  profile: ResourceIntelligenceProfile["agentInterfaces"][number],
): ResourceVerificationRecord["interfaceChecks"][number]["credentialHandling"] {
  const detail = verificationInterface(profile);
  if (detail.credentialOwner === "none" || detail.authentication === "none") {
    return "none-required";
  }
  if (detail.credentialOwner === "user") return "user-owned-not-recorded";
  if (detail.credentialOwner === "workspace") {
    return "workspace-owned-not-recorded";
  }
  return "unknown";
}

function persistencePolicy(
  profile: ResourceIntelligenceProfile["agentInterfaces"][number],
): string {
  return verificationInterface(profile).persistencePolicy ?? "unknown";
}

export function createResourceVerificationDraft(input: {
  identifier: string;
  reviewerId: string;
  reviewerDisplayName?: string;
  startedAt: string;
}): ResourceVerificationRecord {
  const reviewerId = input.reviewerId.trim();
  if (!reviewerId || /\s/u.test(reviewerId)) {
    throw new ResourceVerificationError(
      "reviewerId must be a non-blank identifier without whitespace.",
    );
  }
  const startedAt = requireIsoDate(input.startedAt, "startedAt");
  const { source, intelligence } = verificationTarget(input.identifier);

  return {
    contract: RESOURCE_VERIFICATION_CONTRACT,
    recordVersion: RESOURCE_VERIFICATION_RECORD_VERSION,
    resourceId: source.id,
    resourceSlug: source.slug,
    profileSha256: intelligenceProfileSha256(intelligence),
    profileReviewedAt: intelligence.verifiedAt,
    status: "draft",
    startedAt,
    completedAt: null,
    reviewer: {
      type: "human-operator",
      id: reviewerId,
      displayName: input.reviewerDisplayName?.trim() ?? "",
    },
    availabilityCheck: {
      result: "pending",
      method: "not-run",
      checkedAt: null,
      observedUrl: source.url,
      notes: "",
    },
    claimChecks: intelligence.evidence.map((item) => ({
      claim: item.claim,
      sourceUrl: item.sourceUrl,
      sourceType: item.sourceType,
      result: "pending" as const,
      method: "not-run" as const,
      checkedAt: null,
      notes: "",
    })),
    interfaceChecks: intelligence.agentInterfaces.map((item) => ({
      type: item.type,
      transport: item.transport ?? "in-product",
      result: "pending" as const,
      method: "not-run" as const,
      checkedAt: null,
      credentialHandling: credentialHandling(item),
      persistencePolicy: persistencePolicy(item),
      notes: "",
    })),
    governanceCheck: {
      persistence: "pending",
      redistribution: "pending",
      attribution: "pending",
      terms: "pending",
      termsUrl: null,
      checkedAt: null,
      notes: "",
    },
    limitationsReviewed: false,
    freshness: {
      status: "pending",
      recheckBy: null,
    },
    decision: "pending",
    decisionNotes: "",
  };
}

function requireDate(
  value: string | null,
  field: string,
  errors: string[],
): number | null {
  const parsed = isoDateValue(value);
  if (parsed === null) errors.push(`${field} must be a valid ISO date.`);
  return parsed;
}

function validateCheckDate(
  value: string | null,
  field: string,
  startedAt: number | null,
  completedAt: number | null,
  errors: string[],
): number | null {
  if (value === null) return null;
  const parsed = requireDate(value, field, errors);
  if (parsed === null) return null;
  if (startedAt !== null && parsed < startedAt) {
    errors.push(`${field} cannot be earlier than startedAt.`);
  }
  if (completedAt !== null && parsed > completedAt) {
    errors.push(`${field} cannot be later than completedAt.`);
  }
  return parsed;
}

function exactClaimSet(
  record: ResourceVerificationRecord,
  profile: ResourceIntelligenceProfile,
): boolean {
  return (
    record.claimChecks.length === profile.evidence.length &&
    record.claimChecks.every((check, index) => {
      const evidence = profile.evidence[index];
      return (
        check.claim === evidence.claim &&
        check.sourceUrl === evidence.sourceUrl &&
        check.sourceType === evidence.sourceType
      );
    })
  );
}

function exactInterfaceSet(
  record: ResourceVerificationRecord,
  profile: ResourceIntelligenceProfile,
): boolean {
  return (
    record.interfaceChecks.length === profile.agentInterfaces.length &&
    record.interfaceChecks.every((check, index) => {
      const agentInterface = profile.agentInterfaces[index];
      return (
        check.type === agentInterface.type &&
        check.transport === (agentInterface.transport ?? "in-product") &&
        check.persistencePolicy === persistencePolicy(agentInterface) &&
        check.credentialHandling === credentialHandling(agentInterface)
      );
    })
  );
}

function requiredInterfaceReviewMethod(
  check: ResourceVerificationRecord["interfaceChecks"][number],
): ResourceVerificationRecord["interfaceChecks"][number]["method"] {
  if (check.type === "api") return "manual-api-test";
  if (check.type === "cli" || check.type === "sdk") {
    return "manual-cli-test";
  }
  if (check.type === "plugin") return "manual-browser";
  if (check.type === "mcp") {
    return check.transport === "stdio" || check.transport === "local-process"
      ? "manual-cli-test"
      : "manual-api-test";
  }
  return "not-run";
}

export function validateResourceVerificationRecord(
  record: ResourceVerificationRecord,
  options: { asOfDate?: string } = {},
): VerificationValidationResult {
  const errors: string[] = [];
  let target:
    | { source: SourceProfile; intelligence: ResourceIntelligenceProfile }
    | undefined;

  try {
    target = verificationTarget(record.resourceId);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "Unknown source verification error.",
    );
  }

  if (target) {
    if (record.resourceSlug !== target.source.slug) {
      errors.push("resourceSlug does not match the canonical source.");
    }
    if (record.availabilityCheck.observedUrl !== target.source.url) {
      errors.push(
        "availabilityCheck.observedUrl does not match the canonical source URL.",
      );
    }
    if (record.profileReviewedAt !== target.intelligence.verifiedAt) {
      errors.push(
        "profileReviewedAt does not match the current profile record.",
      );
    }
    if (
      record.profileSha256 !== intelligenceProfileSha256(target.intelligence)
    ) {
      errors.push(
        "profileSha256 is stale or does not match the current profile.",
      );
    }
    if (!exactClaimSet(record, target.intelligence)) {
      errors.push(
        "claimChecks do not match the current profile evidence in order.",
      );
    }
    if (!exactInterfaceSet(record, target.intelligence)) {
      errors.push(
        "interfaceChecks do not match the current profile interfaces in order.",
      );
    }
  }

  if (record.contract !== RESOURCE_VERIFICATION_CONTRACT) {
    errors.push("contract must be tessli.resource-verification.v1.");
  }
  if (record.recordVersion !== RESOURCE_VERIFICATION_RECORD_VERSION) {
    errors.push("recordVersion must be 1.");
  }
  if (
    record.reviewer.type !== "human-operator" ||
    !record.reviewer.id.trim() ||
    /\s/u.test(record.reviewer.id)
  ) {
    errors.push("A non-blank human-operator reviewer ID is required.");
  }

  const profileReviewedAt = requireDate(
    record.profileReviewedAt,
    "profileReviewedAt",
    errors,
  );
  const asOfDate = requireDate(
    options.asOfDate ?? SOURCE_PROFILE_REVIEWED_AT,
    "asOfDate",
    errors,
  );
  const startedAt = requireDate(record.startedAt, "startedAt", errors);
  if (
    profileReviewedAt !== null &&
    startedAt !== null &&
    startedAt < profileReviewedAt
  ) {
    errors.push("startedAt cannot be earlier than profileReviewedAt.");
  }

  if (record.status === "draft") {
    if (record.completedAt !== null) {
      errors.push("Draft records must have completedAt set to null.");
    }
    if (record.decision !== "pending") {
      errors.push("Draft records must keep decision as pending.");
    }

    validateCheckDate(
      record.availabilityCheck.checkedAt,
      "availabilityCheck.checkedAt",
      startedAt,
      null,
      errors,
    );
    record.claimChecks.forEach((check, index) => {
      validateCheckDate(
        check.checkedAt,
        `claimChecks[${index}].checkedAt`,
        startedAt,
        null,
        errors,
      );
    });
    record.interfaceChecks.forEach((check, index) => {
      validateCheckDate(
        check.checkedAt,
        `interfaceChecks[${index}].checkedAt`,
        startedAt,
        null,
        errors,
      );
    });
    validateCheckDate(
      record.governanceCheck.checkedAt,
      "governanceCheck.checkedAt",
      startedAt,
      null,
      errors,
    );
    if (
      record.freshness.recheckBy !== null &&
      isoDateValue(record.freshness.recheckBy) === null
    ) {
      errors.push("freshness.recheckBy must be a valid ISO date.");
    }

    return {
      valid: errors.length === 0,
      eligibleForPromotion: false,
      errors,
    };
  }

  const completedAt = requireDate(record.completedAt, "completedAt", errors);
  if (startedAt !== null && completedAt !== null && completedAt < startedAt) {
    errors.push("completedAt cannot be earlier than startedAt.");
  }
  if (record.decision === "pending") {
    errors.push("Completed records require a non-pending decision.");
  }
  if (!record.decisionNotes.trim()) {
    errors.push("Completed records require decisionNotes.");
  }
  if (record.availabilityCheck.result === "pending") {
    errors.push("Completed records require an availability result.");
  }
  if (record.availabilityCheck.method === "not-run") {
    errors.push("Completed records require an availability check method.");
  }
  if (record.availabilityCheck.checkedAt === null) {
    errors.push("Completed records require availability checkedAt.");
  } else {
    validateCheckDate(
      record.availabilityCheck.checkedAt,
      "availabilityCheck.checkedAt",
      startedAt,
      completedAt,
      errors,
    );
  }

  record.claimChecks.forEach((check, index) => {
    if (check.result === "pending") {
      errors.push(`claimChecks[${index}] cannot remain pending.`);
    }
    if (check.method === "not-run") {
      errors.push(`claimChecks[${index}] requires a review method.`);
    }
    if (check.checkedAt === null) {
      errors.push(`claimChecks[${index}] requires checkedAt.`);
    } else {
      validateCheckDate(
        check.checkedAt,
        `claimChecks[${index}].checkedAt`,
        startedAt,
        completedAt,
        errors,
      );
    }
  });

  record.interfaceChecks.forEach((check, index) => {
    if (check.result === "pending") {
      errors.push(`interfaceChecks[${index}] cannot remain pending.`);
    }
    if (check.method === "not-run") {
      errors.push(`interfaceChecks[${index}] requires a review method.`);
    }
    if (check.checkedAt === null) {
      errors.push(`interfaceChecks[${index}] requires checkedAt.`);
    } else {
      validateCheckDate(
        check.checkedAt,
        `interfaceChecks[${index}].checkedAt`,
        startedAt,
        completedAt,
        errors,
      );
    }
  });

  if (
    [
      record.governanceCheck.persistence,
      record.governanceCheck.redistribution,
      record.governanceCheck.attribution,
      record.governanceCheck.terms,
    ].some((value) => value === "pending")
  ) {
    errors.push("Completed records cannot contain pending governance checks.");
  }
  if (record.governanceCheck.checkedAt === null) {
    errors.push("Completed records require governance checkedAt.");
  } else {
    validateCheckDate(
      record.governanceCheck.checkedAt,
      "governanceCheck.checkedAt",
      startedAt,
      completedAt,
      errors,
    );
  }
  if (!record.limitationsReviewed) {
    errors.push("Completed records require limitationsReviewed=true.");
  }
  if (record.freshness.status === "pending" || !record.freshness.recheckBy) {
    errors.push(
      "Completed records require a freshness status and recheckBy date.",
    );
  } else {
    const recheckBy = requireDate(
      record.freshness.recheckBy,
      "freshness.recheckBy",
      errors,
    );
    if (completedAt !== null && recheckBy !== null && recheckBy < completedAt) {
      errors.push("freshness.recheckBy cannot be earlier than completedAt.");
    }
    if (asOfDate !== null && recheckBy !== null && recheckBy < asOfDate) {
      errors.push(
        "freshness.recheckBy is stale for the current source-profile review date.",
      );
    }
  }

  if (record.decision === "verified") {
    if (record.availabilityCheck.result !== "passed") {
      errors.push("Verified decisions require a passed availability check.");
    }
    if (record.availabilityCheck.method !== "manual-browser") {
      errors.push(
        "Verified decisions require canonical availability to be checked with manual-browser.",
      );
    }
    if (record.claimChecks.some((check) => check.result !== "confirmed")) {
      errors.push("Verified decisions require every claim to be confirmed.");
    }
    if (record.interfaceChecks.some((check) => check.result !== "passed")) {
      errors.push(
        "Verified decisions require every recorded interface to pass.",
      );
    }
    record.interfaceChecks.forEach((check, index) => {
      const requiredMethod = requiredInterfaceReviewMethod(check);
      if (check.method !== requiredMethod) {
        errors.push(
          `Verified interfaceChecks[${index}] requires ${requiredMethod}; documentation review alone cannot pass an interface.`,
        );
      }
    });
    for (const field of [
      "persistence",
      "redistribution",
      "attribution",
      "terms",
    ] as const) {
      if (record.governanceCheck[field] !== "confirmed") {
        errors.push(
          `Verified decisions require governance ${field}=confirmed.`,
        );
      }
    }
    if (!record.governanceCheck.termsUrl) {
      errors.push("Verified decisions require a current governance termsUrl.");
    }
    if (record.freshness.status !== "current") {
      errors.push("Verified decisions require current freshness.");
    }
  }

  return {
    valid: errors.length === 0,
    eligibleForPromotion: errors.length === 0 && record.decision === "verified",
    errors,
  };
}
