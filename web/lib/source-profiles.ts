import catalogue from "../data/catalogue.json" with { type: "json" };
import {
  getCanonicalAccessRoutes,
  type AccessRoute,
} from "../data/access-route-pilot.ts";
import {
  getAllIntelligenceProfiles,
  getIntelligenceProfile,
  type ResourceIntelligenceProfile,
} from "./intelligence.ts";

export const SOURCE_PROFILE_CONTRACT_VERSION = 1 as const;
export const SOURCE_PROFILE_REVIEWED_AT = "2026-08-05" as const;
export const SOURCE_FRESHNESS_WINDOWS = Object.freeze({
  currentMaxDays: 90,
  agingMaxDays: 180,
});

export const SOURCE_TYPES = Object.freeze([
  "inspiration-directory",
  "product-reference-library",
  "marketing-reference-library",
  "implementation-library",
  "design-system",
  "creative-technology-resource",
  "typography-resource",
  "color-accessibility-resource",
  "icon-library",
  "visual-asset-library",
  "design-ai-tool",
] as const);

export type SourceType = (typeof SOURCE_TYPES)[number];
export type SourceCoverageLevel = "listed" | "profiled" | "verified";
export type SourceConfidence = "certain" | "likely" | "unknown";
export type HumanReviewStatus = "not-recorded" | "completed";
export type FreshnessStatus = "current" | "aging" | "stale" | "unknown";
export type SourceStatus = "active" | "inactive" | "unknown";

type CatalogueResource = (typeof catalogue.resources)[number];

type ReviewAwareIntelligenceProfile = ResourceIntelligenceProfile & {
  humanReview?: {
    status?: string;
    reviewedAt?: string;
  };
};

export interface SourceAccessModel {
  access: string;
  subscriptionRequired: string;
}

export interface SourceCoverage {
  level: SourceCoverageLevel;
  reason: string;
  profileStatus: string | null;
  lastVerifiedAt: string | null;
  confidence: SourceConfidence;
  humanReviewStatus: HumanReviewStatus;
  freshnessStatus: FreshnessStatus;
  evidenceCount: number;
}

export interface SourceProfile {
  contractVersion: typeof SOURCE_PROFILE_CONTRACT_VERSION;
  id: string;
  slug: string;
  name: string;
  url: string;
  domain: string;
  summary: string;
  category: string;
  sourceType: SourceType;
  sourceTypeBasis: "category-classification";
  accessModel: SourceAccessModel;
  bestFor: ResourceIntelligenceProfile["workflowFit"];
  capabilities: ResourceIntelligenceProfile["capabilities"];
  contentObjects: ResourceIntelligenceProfile["contentObjects"];
  platforms: ResourceIntelligenceProfile["platforms"];
  frameworks: ResourceIntelligenceProfile["frameworks"];
  integrationMethods: ResourceIntelligenceProfile["integrationMethods"];
  accessRoutes: readonly AccessRoute[];
  limitations: ResourceIntelligenceProfile["limitations"];
  profileLevel: SourceCoverageLevel;
  status: SourceStatus;
  verifiedAt: string | null;
  evidence: ResourceIntelligenceProfile["evidence"];
  coverage: SourceCoverage;
  intelligence: ResourceIntelligenceProfile | null;
}

export const SOURCE_TYPE_BY_CATEGORY: Readonly<Record<string, SourceType>> =
  Object.freeze({
    "website-inspiration": "inspiration-directory",
    "product-ui-ux": "product-reference-library",
    "landing-marketing": "marketing-reference-library",
    "ui-libraries": "implementation-library",
    "design-systems": "design-system",
    "motion-3d": "creative-technology-resource",
    typography: "typography-resource",
    "color-accessibility": "color-accessibility-resource",
    icons: "icon-library",
    "visual-assets": "visual-asset-library",
    "design-tools-ai": "design-ai-tool",
  });

const MILLISECONDS_PER_DAY = 86_400_000;

function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export function deriveFreshnessStatus(
  verifiedAt: string | null,
  reviewedAt = SOURCE_PROFILE_REVIEWED_AT,
): FreshnessStatus {
  if (!isIsoDate(verifiedAt) || !isIsoDate(reviewedAt)) return "unknown";

  const ageDays = Math.floor(
    (Date.parse(`${reviewedAt}T00:00:00Z`) -
      Date.parse(`${verifiedAt}T00:00:00Z`)) /
      MILLISECONDS_PER_DAY,
  );

  if (ageDays < 0) return "unknown";
  if (ageDays <= SOURCE_FRESHNESS_WINDOWS.currentMaxDays) return "current";
  if (ageDays <= SOURCE_FRESHNESS_WINDOWS.agingMaxDays) return "aging";
  return "stale";
}

export function deriveEvidenceConfidence(
  profile: ResourceIntelligenceProfile | null,
): SourceConfidence {
  if (!profile || profile.evidence.length === 0) return "unknown";

  const confidenceValues = profile.evidence.map((item) => item.confidence);
  if (
    confidenceValues.some((value) => value !== "certain" && value !== "likely")
  ) {
    return "unknown";
  }
  if (confidenceValues.some((value) => value === "likely")) return "likely";
  return "certain";
}

function deriveHumanReviewStatus(
  profile: ResourceIntelligenceProfile | null,
): HumanReviewStatus {
  const review = (profile as ReviewAwareIntelligenceProfile | null)
    ?.humanReview;
  return review?.status === "completed" && isIsoDate(review.reviewedAt)
    ? "completed"
    : "not-recorded";
}

export function deriveCoverageLevel(
  profile: ResourceIntelligenceProfile | null,
  humanReviewStatus = deriveHumanReviewStatus(profile),
): SourceCoverageLevel {
  if (!profile) return "listed";

  const confidence = deriveEvidenceConfidence(profile);
  const hasRecordedEvidence =
    isIsoDate(profile.verifiedAt) &&
    profile.evidence.length > 0 &&
    confidence !== "unknown";

  if (
    profile.status === "verified" &&
    humanReviewStatus === "completed" &&
    hasRecordedEvidence
  ) {
    return "verified";
  }

  return "profiled";
}

function coverageReason(
  level: SourceCoverageLevel,
  humanReviewStatus: HumanReviewStatus,
): string {
  if (level === "listed") {
    return "Catalogue identity and access metadata are present; no structured intelligence profile is linked.";
  }
  if (level === "verified") {
    return "Structured intelligence, evidence, verification date, confidence, and explicit human review are recorded.";
  }
  if (humanReviewStatus === "not-recorded") {
    return "Structured intelligence and evidence are present; explicit human-review provenance is not recorded.";
  }
  return "Structured intelligence is present but the full Verified coverage contract is incomplete.";
}

function sourceStatus(status: string): SourceStatus {
  if (status === "active" || status === "inactive") return status;
  return "unknown";
}

function intelligenceForResource(
  resource: CatalogueResource,
): ResourceIntelligenceProfile | null {
  return (
    getIntelligenceProfile(resource.id) ?? getIntelligenceProfile(resource.slug)
  );
}

function buildSourceProfile(resource: CatalogueResource): SourceProfile {
  const intelligence = intelligenceForResource(resource);
  const humanReviewStatus = deriveHumanReviewStatus(intelligence);
  const profileLevel = deriveCoverageLevel(intelligence, humanReviewStatus);
  const sourceType = SOURCE_TYPE_BY_CATEGORY[resource.category];

  if (!sourceType) {
    throw new Error(`No source type classification for ${resource.category}.`);
  }

  return {
    contractVersion: SOURCE_PROFILE_CONTRACT_VERSION,
    id: resource.id,
    slug: resource.slug,
    name: resource.name,
    url: resource.url,
    domain: resource.domain,
    summary: resource.description,
    category: resource.category,
    sourceType,
    sourceTypeBasis: "category-classification",
    accessModel: {
      access: resource.access,
      subscriptionRequired: resource.subscriptionRequired,
    },
    bestFor: intelligence?.workflowFit ?? [],
    capabilities: intelligence?.capabilities ?? [],
    contentObjects: intelligence?.contentObjects ?? [],
    platforms: intelligence?.platforms ?? [],
    frameworks: intelligence?.frameworks ?? [],
    integrationMethods: intelligence?.integrationMethods ?? [],
    accessRoutes: getCanonicalAccessRoutes(resource),
    limitations: intelligence?.limitations ?? [],
    profileLevel,
    status: sourceStatus(resource.status),
    verifiedAt: intelligence?.verifiedAt ?? null,
    evidence: intelligence?.evidence ?? [],
    coverage: {
      level: profileLevel,
      reason: coverageReason(profileLevel, humanReviewStatus),
      profileStatus: intelligence?.status ?? null,
      lastVerifiedAt: intelligence?.verifiedAt ?? null,
      confidence: deriveEvidenceConfidence(intelligence),
      humanReviewStatus,
      freshnessStatus: deriveFreshnessStatus(intelligence?.verifiedAt ?? null),
      evidenceCount: intelligence?.evidence.length ?? 0,
    },
    intelligence,
  };
}

const sourceProfiles = catalogue.resources.map(buildSourceProfile);
const sourceProfilesByIdentifier = new Map<string, SourceProfile>();

for (const profile of sourceProfiles) {
  sourceProfilesByIdentifier.set(profile.id, profile);
  sourceProfilesByIdentifier.set(profile.slug, profile);
}

export function getAllSourceProfiles(): readonly SourceProfile[] {
  return sourceProfiles;
}

export function getSourceProfile(identifier: string): SourceProfile | null {
  return sourceProfilesByIdentifier.get(identifier.trim()) ?? null;
}

export function getSourceCoverageCounts(): Readonly<
  Record<SourceCoverageLevel, number>
> {
  const counts: Record<SourceCoverageLevel, number> = {
    listed: 0,
    profiled: 0,
    verified: 0,
  };

  for (const profile of sourceProfiles) {
    counts[profile.profileLevel] += 1;
  }

  return counts;
}

export function getSourceContractSummary() {
  return {
    contractVersion: SOURCE_PROFILE_CONTRACT_VERSION,
    reviewedAt: SOURCE_PROFILE_REVIEWED_AT,
    resourceCount: sourceProfiles.length,
    intelligenceProfileCount: getAllIntelligenceProfiles().length,
    coverageCounts: getSourceCoverageCounts(),
  };
}
