import catalogue from "../data/catalogue.json" with { type: "json" };
import {
  getIntelligenceBadge,
  getIntelligenceProfile,
  type ResourceIntelligenceProfile,
} from "./intelligence.ts";
import { getSourceProfile } from "./source-profiles.ts";
import {
  buildResearchStack,
  generateMarkdownReferencePacket,
} from "./research-packet.ts";

type CatalogueResource = (typeof catalogue.resources)[number];
type CatalogueCollection = (typeof catalogue.collections)[number];

export const NATIVE_MCP_LIMITS = Object.freeze({
  searchResults: 25,
  comparisonResources: 5,
  researchResources: 10,
});

export const NATIVE_CATEGORY_IDS = Object.freeze(
  catalogue.categories.map((category) => category.id),
);

export const NATIVE_ACCESS_VALUES = Object.freeze(
  Array.from(new Set(catalogue.resources.map((resource) => resource.access))),
);

export class NativeMcpInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeMcpInputError";
  }
}

export type SearchResourcesInput = Readonly<{
  query?: string;
  category?: string;
  access?: string;
  capabilities?: readonly string[];
  frameworks?: readonly string[];
  integrationMethods?: readonly string[];
  workflowFit?: readonly string[];
  limit?: number;
}>;

export type ResearchSelectionInput = Readonly<{
  taskName: string;
  identifiers: readonly string[];
  generatedAt?: string;
}>;

const categoryLabelById = new Map(
  catalogue.categories.map((category) => [category.id, category.label]),
);

const resourcesByIdentifier = new Map<string, CatalogueResource>();
for (const resource of catalogue.resources) {
  resourcesByIdentifier.set(resource.id, resource);
  resourcesByIdentifier.set(resource.slug, resource);
}

const collectionsByIdentifier = new Map<string, CatalogueCollection>();
for (const collection of catalogue.collections) {
  if (collection.status !== "published") continue;
  collectionsByIdentifier.set(collection.id, collection);
  collectionsByIdentifier.set(collection.slug, collection);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function normalizeList(values: readonly string[] | undefined): string[] {
  if (!values) return [];

  return Array.from(
    new Set(values.map(normalize).filter((value) => value.length > 0)),
  );
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

function resolveResource(identifier: string): CatalogueResource {
  const normalizedIdentifier = identifier.trim();
  const resource = resourcesByIdentifier.get(normalizedIdentifier);
  if (!resource) {
    throw new NativeMcpInputError(
      `Unknown Tessli resource identifier: ${normalizedIdentifier || "(blank)"}.`,
    );
  }

  return resource;
}

function resolveUniqueResources(
  identifiers: readonly string[],
  minimum: number,
  maximum: number,
): CatalogueResource[] {
  requireIntegerInRange(identifiers.length, minimum, maximum, "identifiers");

  const resources: CatalogueResource[] = [];
  const seen = new Set<string>();

  for (const identifier of identifiers) {
    const resource = resolveResource(identifier);
    if (seen.has(resource.id)) continue;
    seen.add(resource.id);
    resources.push(resource);
  }

  if (resources.length < minimum) {
    throw new NativeMcpInputError(
      `At least ${minimum} unique Tessli resource${minimum === 1 ? "" : "s"} required.`,
    );
  }

  return resources;
}

function getProfile(
  resource: CatalogueResource,
): ResourceIntelligenceProfile | null {
  return (
    getIntelligenceProfile(resource.id) ?? getIntelligenceProfile(resource.slug)
  );
}

function matchesEvery(
  availableValues: readonly string[],
  requestedValues: readonly string[],
): boolean {
  if (requestedValues.length === 0) return true;
  const normalizedAvailable = new Set(availableValues.map(normalize));
  return requestedValues.every((value) => normalizedAvailable.has(value));
}

function createSearchDocument(
  resource: CatalogueResource,
  profile: ResourceIntelligenceProfile | null,
): string {
  return [
    resource.name,
    resource.slug,
    resource.domain,
    resource.description,
    resource.category,
    categoryLabelById.get(resource.category) ?? "",
    resource.access,
    ...resource.usefulFor,
    ...resource.tags,
    profile?.summary ?? "",
    ...(profile?.capabilities ?? []),
    ...(profile?.contentObjects ?? []),
    ...(profile?.platforms ?? []),
    ...(profile?.frameworks ?? []),
    ...(profile?.designTools ?? []),
    ...(profile?.deliveryFormats ?? []),
    ...(profile?.integrationMethods ?? []),
    ...(profile?.workflowFit ?? []),
    ...(profile?.limitations ?? []),
  ]
    .map(normalize)
    .join(" ");
}

function toResourceSummary(resource: CatalogueResource) {
  const profile = getProfile(resource);
  const sourceProfile = getSourceProfile(resource.id);

  return {
    id: resource.id,
    slug: resource.slug,
    name: resource.name,
    url: resource.url,
    domain: resource.domain,
    description: resource.description,
    category: resource.category,
    categoryLabel:
      categoryLabelById.get(resource.category) ?? resource.category,
    access: resource.access,
    status: resource.status,
    profileAvailable: profile !== null,
    intelligenceBadge: profile ? getIntelligenceBadge(profile) : null,
    profileStatus: profile?.status ?? null,
    verifiedAt: profile?.verifiedAt ?? null,
    capabilities: profile?.capabilities ?? [],
    frameworks: profile?.frameworks ?? [],
    integrationMethods: profile?.integrationMethods ?? [],
    workflowFit: profile?.workflowFit ?? [],
    accessRoutes: sourceProfile?.accessRoutes ?? [],
  };
}

function toComparisonEntry(resource: CatalogueResource) {
  const profile = getProfile(resource);

  return {
    ...toResourceSummary(resource),
    summary: profile?.summary ?? null,
    contentObjects: profile?.contentObjects ?? [],
    platforms: profile?.platforms ?? [],
    designTools: profile?.designTools ?? [],
    deliveryFormats: profile?.deliveryFormats ?? [],
    agentInterfaces: profile?.agentInterfaces ?? [],
    limitations: profile?.limitations ?? [],
    governance: profile?.governance ?? null,
    evidenceCount: profile?.evidence.length ?? 0,
  };
}

export function searchNativeResources(input: SearchResourcesInput = {}) {
  const query = input.query?.trim() ?? "";
  const queryTokens = normalize(query).split(/\s+/u).filter(Boolean);
  const category = input.category?.trim() || null;
  const access = input.access?.trim() || null;
  const capabilities = normalizeList(input.capabilities);
  const frameworks = normalizeList(input.frameworks);
  const integrationMethods = normalizeList(input.integrationMethods);
  const workflowFit = normalizeList(input.workflowFit);
  const limit = requireIntegerInRange(
    input.limit ?? 10,
    1,
    NATIVE_MCP_LIMITS.searchResults,
    "limit",
  );

  const matches = catalogue.resources.filter((resource) => {
    const profile = getProfile(resource);

    if (category && resource.category !== category) return false;
    if (access && resource.access !== access) return false;
    if (
      !matchesEvery(profile?.capabilities ?? [], capabilities) ||
      !matchesEvery(profile?.frameworks ?? [], frameworks) ||
      !matchesEvery(profile?.integrationMethods ?? [], integrationMethods) ||
      !matchesEvery(profile?.workflowFit ?? [], workflowFit)
    ) {
      return false;
    }

    if (queryTokens.length === 0) return true;
    const document = createSearchDocument(resource, profile);
    return queryTokens.every((token) => document.includes(token));
  });

  return {
    query,
    filters: {
      category,
      access,
      capabilities,
      frameworks,
      integrationMethods,
      workflowFit,
    },
    limit,
    total: matches.length,
    returned: Math.min(matches.length, limit),
    resources: matches.slice(0, limit).map(toResourceSummary),
  };
}

export function getNativeResourceProfile(identifier: string) {
  const resource = resolveResource(identifier);
  const profile = getProfile(resource);

  return {
    resource: toResourceSummary(resource),
    intelligenceProfile: profile,
    interpretationBoundary:
      "Capabilities and workflow fit are Tessli classifications. Revalidate time-sensitive provider claims before relying on them.",
  };
}

export function compareNativeResources(identifiers: readonly string[]) {
  const resources = resolveUniqueResources(
    identifiers,
    2,
    NATIVE_MCP_LIMITS.comparisonResources,
  );

  return {
    requested: identifiers.length,
    compared: resources.length,
    resources: resources.map(toComparisonEntry),
    comparisonBoundary:
      "This comparison reports repository metadata and evidence; it is not a live provider, pricing, availability, or terms check.",
  };
}

export function getNativeCollection(identifier: string) {
  const normalizedIdentifier = identifier.trim();
  const collection = collectionsByIdentifier.get(normalizedIdentifier);
  if (!collection) {
    throw new NativeMcpInputError(
      `Unknown published Tessli collection identifier: ${normalizedIdentifier || "(blank)"}.`,
    );
  }

  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    coverStyle: collection.coverStyle,
    status: collection.status,
    lastReviewedAt: collection.lastReviewedAt,
    resourceCount: collection.resourceIds.length,
    resources: collection.resourceIds.map((resourceId, index) => ({
      order: index + 1,
      ...toResourceSummary(resolveResource(resourceId)),
    })),
  };
}

export function buildNativeResearchPlan(input: ResearchSelectionInput) {
  const resources = resolveUniqueResources(
    input.identifiers,
    1,
    NATIVE_MCP_LIMITS.researchResources,
  );
  const stack = buildResearchStack(
    input.taskName.trim(),
    resources.map((resource) => resource.id),
    { generatedAt: input.generatedAt },
  );

  const sourceSteps = stack.resources.map((resource, index) => {
    const profile = resource.intelligenceProfile;
    return {
      order: index + 2,
      phase: "source-review",
      resourceId: resource.id,
      resourceSlug: resource.slug,
      resourceName: resource.name,
      action: `Inspect ${resource.name} for ${(
        profile?.workflowFit.slice(0, 3) ?? [resource.category]
      ).join(", ")}.`,
      focus: profile?.capabilities.slice(0, 5) ?? [resource.category],
      limitations: profile?.limitations.slice(0, 3) ?? [],
      verifiedAt: profile?.verifiedAt ?? null,
    };
  });

  const synthesisOrder = sourceSteps.length + 2;

  return {
    taskName: stack.taskName,
    generatedAt: stack.generatedAt,
    resourceCount: stack.resources.length,
    selectedResources: stack.resources.map((resource) => ({
      id: resource.id,
      slug: resource.slug,
      name: resource.name,
      url: resource.url,
      badge: resource.badge,
    })),
    steps: [
      {
        order: 1,
        phase: "constraints",
        action:
          "Record the product, audience, surface, content, responsive, accessibility, technical, and originality constraints before reviewing references.",
      },
      ...sourceSteps,
      {
        order: synthesisOrder,
        phase: "synthesis",
        action:
          "Extract transferable principles from multiple sources and write an original design contract for the target project.",
      },
      {
        order: synthesisOrder + 1,
        phase: "verification",
        action:
          "Revalidate provider claims, preserve provenance, and review originality, keyboard use, focus, contrast, touch targets, responsive behavior, and implementation fit.",
      },
    ],
  };
}

export function createNativeReferencePacket(input: ResearchSelectionInput) {
  const resources = resolveUniqueResources(
    input.identifiers,
    1,
    NATIVE_MCP_LIMITS.researchResources,
  );
  const stack = buildResearchStack(
    input.taskName.trim(),
    resources.map((resource) => resource.id),
    { generatedAt: input.generatedAt },
  );

  return {
    taskName: stack.taskName,
    generatedAt: stack.generatedAt,
    resourceCount: stack.resources.length,
    resourceIds: stack.resources.map((resource) => resource.id),
    markdown: generateMarkdownReferencePacket(stack),
  };
}

export function verifyNativeResource(identifier: string) {
  const resource = resolveResource(identifier);
  const profile = getProfile(resource);

  return {
    liveCheckPerformed: false,
    verificationMode: "repository-recorded-only",
    resource: {
      id: resource.id,
      slug: resource.slug,
      name: resource.name,
      url: resource.url,
      catalogueStatus: resource.status,
    },
    catalogueSource: {
      path: catalogue.source.path,
      sha256: catalogue.source.sha256,
      rowCount: catalogue.source.rowCount,
    },
    profileAvailable: profile !== null,
    profileStatus: profile?.status ?? null,
    profileVerifiedAt: profile?.verifiedAt ?? null,
    evidence: profile?.evidence ?? [],
    limitations: profile?.limitations ?? [],
    warning:
      "No live website, pricing, terms, licence, availability, API, or provider verification was performed.",
  };
}
