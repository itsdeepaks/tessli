export interface PublicRepresentationHeadersInput {
  format: "json" | "markdown";
  filename: string;
  canonicalPath: string;
  jsonPath: string;
  markdownPath: string;
}

export interface PublicRepresentationLinks {
  json: string;
  markdown: string;
}

export interface PublicAccessRoute {
  kind: string;
  preferred: boolean;
  auth: string;
  agentAction: string;
  url?: string;
}

export interface PublicSourceAlternative {
  slug: string;
  name: string;
  canonicalPath: string;
  providerUrl: string;
  differentiator: string;
}

export interface PublicSourceDiagnostics {
  coverage: {
    level: string;
    profileStatus?: string;
    recordedVerifiedAt?: string;
    confidence?: string;
    humanReviewStatus?: string;
    freshnessStatus?: string;
  };
  evidenceCount?: number;
  governance?: {
    defaultPersistence?: string;
    assetRedistribution?: string;
    sourceAttribution?: string;
    userCredentialRequired?: boolean;
    termsReviewRequired?: boolean;
  };
}

export interface PublicSourceDocument {
  contract: "tessli.public-source.v2";
  canonicalPath: string;
  representations: PublicRepresentationLinks;
  source: {
    id: string;
    slug: string;
    name: string;
    purpose: string;
    providerUrl: string;
    category: string;
    sourceType: string;
    profileLevel: string;
    useWhen: readonly string[];
    whatToExplore: readonly string[];
    accessRoutes: readonly PublicAccessRoute[];
    importantLimitations: readonly string[];
    alternatives: readonly PublicSourceAlternative[];
  };
  diagnostics?: PublicSourceDiagnostics;
  boundaries: readonly string[];
}

export interface PublicSourceAlternativeProfile {
  id: string;
  slug: string;
  name: string;
  url: string;
}

export interface PublicSimilarSourceMatch {
  profile: PublicSourceAlternativeProfile;
  differentiator: string;
}

export interface PublicCollectionSourceGuide {
  id: string;
  slug: string;
  name: string;
  canonicalPath: string;
  jsonPath: string;
  markdownPath: string;
  providerUrl: string;
  accessAction?: PublicAccessRoute;
}

export interface PublicCollectionResource {
  order: number;
  role: string;
  inspectPrompt: string;
  decisionPrompt: string;
  sourceGuide: PublicCollectionSourceGuide;
}

export interface PublicCollectionStage {
  order: number;
  id: string;
  title: string;
  resources: readonly PublicCollectionResource[];
}

export interface PublicCollectionDocument {
  contract: "tessli.public-collection.v2";
  canonicalPath: string;
  representations: PublicRepresentationLinks;
  collection: {
    id: string;
    slug: string;
    title: string;
    description: string;
    outcome: string;
    audience: string;
    stageCount: number;
    resourceCount: number;
    stages: readonly PublicCollectionStage[];
  };
  boundaries: readonly string[];
}

export const PUBLIC_SOURCE_REPRESENTATION_CONTRACT: "tessli.public-source.v2";
export const PUBLIC_COLLECTION_REPRESENTATION_CONTRACT: "tessli.public-collection.v2";

export function createPublicSourceRepresentation(
  profile: unknown,
  similarSources?: readonly PublicSimilarSourceMatch[],
): PublicSourceDocument;
export function createPublicCollectionRepresentation(
  collection: unknown,
  sourceProfiles: readonly unknown[],
): PublicCollectionDocument;
export function serializePublicJson(value: unknown): string;
export function serializePublicSourceMarkdown(
  document: PublicSourceDocument,
): string;
export function serializePublicCollectionMarkdown(
  document: PublicCollectionDocument,
): string;
export function createPublicRepresentationHeaders(
  input: PublicRepresentationHeadersInput,
): Record<string, string>;
export function createPublicOptionsHeaders(): Record<string, string>;
