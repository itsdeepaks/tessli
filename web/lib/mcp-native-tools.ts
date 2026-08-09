import catalogue from "../data/catalogue.json" with { type: "json" };
import { getSimilarSourceProfiles } from "./similar-sources.ts";
import { getSourceProfile, type SourceProfile } from "./source-profiles.ts";
import {
  retrieveTaskSources,
  type TaskRetrievalInput,
} from "./task-retrieval.ts";

type CatalogueCollection = (typeof catalogue.collections)[number];

export const NATIVE_MCP_LIMITS = Object.freeze({
  alternatives: 4,
  sourceAlternatives: 2,
  collectionSources: 12,
});

export class NativeMcpInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeMcpInputError";
  }
}

const collectionsByIdentifier = new Map<string, CatalogueCollection>();
for (const collection of catalogue.collections) {
  if (collection.status !== "published") continue;
  collectionsByIdentifier.set(collection.id, collection);
  collectionsByIdentifier.set(collection.slug, collection);
}

function requireIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new NativeMcpInputError(
      `${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function resolveSourceProfile(identifier: string): SourceProfile {
  const normalizedIdentifier = identifier.trim();
  const profile = getSourceProfile(normalizedIdentifier);
  if (!profile) {
    throw new NativeMcpInputError(
      `Unknown Tessli resource identifier: ${normalizedIdentifier || "(blank)"}.`,
    );
  }

  return profile;
}

function resolveCollection(identifier: string): CatalogueCollection {
  const normalizedIdentifier = identifier.trim();
  const collection = collectionsByIdentifier.get(normalizedIdentifier);
  if (!collection) {
    throw new NativeMcpInputError(
      `Unknown published Tessli collection identifier: ${normalizedIdentifier || "(blank)"}.`,
    );
  }

  return collection;
}

function toAccessRoutes(profile: SourceProfile) {
  return profile.accessRoutes.map((route) => ({ ...route }));
}

function toSourceGuide(profile: SourceProfile) {
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    url: profile.url,
    summary: profile.summary,
    sourceType: profile.sourceType,
    profileLevel: profile.profileLevel,
    status: profile.status,
    accessModel: { ...profile.accessModel },
    whatItHelpsWith: profile.bestFor.slice(0, 4),
    whatToInspect: [...profile.capabilities, ...profile.contentObjects].slice(
      0,
      6,
    ),
    accessRoutes: toAccessRoutes(profile),
    caveats: profile.limitations.slice(0, 3),
    coverageNote: profile.coverage.reason,
  };
}

function toAlternativeGuide(profile: SourceProfile, differentiator: string) {
  return {
    ...toSourceGuide(profile),
    differentiator,
  };
}

function findAlternativesForSource(profile: SourceProfile, limit: number) {
  return getSimilarSourceProfiles(profile, limit).map(
    ({ profile: alternative, differentiator }) =>
      toAlternativeGuide(alternative, differentiator),
  );
}

/**
 * Keeps V3.7 task retrieval as the canonical MCP task-search path. Its
 * normalized input, stable ordering, explained choices, routes, caveats, and
 * eight-source cap are deliberately returned without an MCP-specific ranking.
 */
export function findNativeSources(input: TaskRetrievalInput) {
  return retrieveTaskSources(input);
}

export function getNativeSource(identifier: string) {
  const profile = resolveSourceProfile(identifier);

  return {
    source: toSourceGuide(profile),
    alternatives: findAlternativesForSource(
      profile,
      NATIVE_MCP_LIMITS.sourceAlternatives,
    ),
    boundary:
      "This is repository-recorded source guidance, not a live provider, pricing, availability, terms, or licence check.",
  };
}

export function findNativeAlternatives(
  identifier: string,
  limit: number = NATIVE_MCP_LIMITS.alternatives,
) {
  const profile = resolveSourceProfile(identifier);
  const boundedLimit = requireIntegerInRange(
    limit,
    1,
    NATIVE_MCP_LIMITS.alternatives,
    "limit",
  );

  return {
    source: toSourceGuide(profile),
    limit: boundedLimit,
    alternatives: findAlternativesForSource(profile, boundedLimit),
    boundary:
      "Alternatives are differentiated by recorded source metadata; they are not universal recommendations or live provider comparisons.",
  };
}

export function getNativeCollection(identifier: string) {
  const collection = resolveCollection(identifier);
  const resourceIds = collection.resourceIds.slice(
    0,
    NATIVE_MCP_LIMITS.collectionSources,
  );

  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    outcome: collection.outcome,
    audience: collection.audience,
    status: collection.status,
    lastReviewedAt: collection.lastReviewedAt,
    resourceCount: collection.resourceIds.length,
    returnedSourceCount: resourceIds.length,
    sources: resourceIds.map((resourceId, index) => ({
      order: index + 1,
      ...toSourceGuide(resolveSourceProfile(resourceId)),
    })),
    stages: collection.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      inspect: stage.inspect,
      decision: stage.decision,
      sources: stage.items
        .filter((item) => resourceIds.includes(item.resourceId))
        .map((item) => {
          const source = resolveSourceProfile(item.resourceId);
          return {
            sourceId: source.id,
            sourceSlug: source.slug,
            role: item.role,
          };
        }),
    })),
    boundary:
      "Collection roles and source guidance are repository-recorded; provider access remains outside Tessli.",
  };
}

export function createNativeResearchBrief(input: TaskRetrievalInput) {
  const retrieval = findNativeSources(input);

  return {
    task: retrieval.input,
    sourceCount: retrieval.sources.length,
    sources: retrieval.sources,
    nextSteps: [
      "Review each source's recorded fit reasons and caveats before choosing a direction.",
      "Use the preferred recorded access route to inspect the provider within its own access requirements.",
      "Turn selected principles into an original project decision, then verify the implemented result with people and in a browser.",
    ],
    boundary:
      "The brief is deterministic, repository-backed guidance. It does not access local Boards, inspect project code, fetch providers, use credentials, or write state.",
  };
}

/**
 * Direct library compatibility for the V3.2 profile-parity checks. This is not
 * registered as a local MCP tool and has no provider or filesystem effects.
 */
export function getNativeResourceProfile(identifier: string) {
  const profile = resolveSourceProfile(identifier);

  return {
    resource: {
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      url: profile.url,
      accessRoutes: toAccessRoutes(profile),
    },
    intelligenceProfile: profile.intelligence,
    interpretationBoundary:
      "Capabilities and workflow fit are Tessli classifications. Revalidate time-sensitive provider claims before relying on them.",
  };
}
