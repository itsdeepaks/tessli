import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  PUBLIC_COLLECTION_REPRESENTATION_CONTRACT,
  PUBLIC_SOURCE_REPRESENTATION_CONTRACT,
  createPublicCollectionRepresentation,
  createPublicOptionsHeaders,
  createPublicRepresentationHeaders,
  createPublicSourceRepresentation,
  serializePublicCollectionMarkdown,
  serializePublicJson,
  serializePublicSourceMarkdown,
} from "../lib/public-representations.mjs";

const browserAccess = {
  kind: "browser",
  preferred: true,
  auth: "none",
  agentAction: "Open the source in a browser.",
  url: "https://example.com",
};

const profiled = {
  contractVersion: 1,
  id: "source-one",
  slug: "source-one",
  name: "Source One",
  url: "https://example.com",
  domain: "example.com",
  summary: "Compare interface hierarchy and component patterns.",
  category: "website-inspiration",
  sourceType: "inspiration-directory",
  sourceTypeBasis: "category-classification",
  accessModel: { access: "free", subscriptionRequired: "no" },
  bestFor: ["hierarchy", "component evaluation"],
  capabilities: ["inspiration", "components"],
  contentObjects: ["components", "websites"],
  platforms: ["web"],
  frameworks: [],
  integrationMethods: ["web-ui"],
  accessRoutes: [browserAccess],
  limitations: ["No source code", "No source code"],
  profileLevel: "profiled",
  status: "active",
  verifiedAt: "2026-07-01",
  evidence: [
    {
      claim: "Recorded claim",
      sourceUrl: "https://example.com/docs",
      sourceType: "official-docs",
      verifiedAt: "2026-07-01",
      confidence: "certain",
    },
  ],
  coverage: {
    level: "profiled",
    reason: "Structured intelligence is present.",
    profileStatus: "verified",
    lastVerifiedAt: "2026-07-01",
    confidence: "certain",
    humanReviewStatus: "not-recorded",
    freshnessStatus: "current",
    evidenceCount: 1,
  },
  intelligence: {
    profileVersion: 1,
    status: "verified",
    verifiedAt: "2026-07-01",
    summary: "Intelligence summary that must not become a raw packet dump.",
    designTools: ["figma"],
    deliveryFormats: ["web"],
    agentInterfaces: [{ type: "mcp", transport: "stdio" }],
    discovery: { textSearch: true, facets: ["type"] },
    governance: {
      defaultPersistence: "transient",
      assetRedistribution: "restricted",
      sourceAttribution: "required",
      userCredentialRequired: false,
      termsReviewRequired: true,
      notes: ["Raw governance notes must not be published."],
    },
  },
};

const listed = {
  ...profiled,
  id: "source-two",
  slug: "source-two",
  name: "Source Two",
  url: "https://two.example",
  domain: "two.example",
  summary: "A catalogue-listed source with only identity metadata.",
  profileLevel: "listed",
  verifiedAt: null,
  bestFor: [],
  capabilities: [],
  contentObjects: [],
  platforms: [],
  integrationMethods: [],
  accessRoutes: [],
  limitations: [],
  evidence: [],
  coverage: {
    level: "listed",
    reason: "Catalogue metadata only.",
    profileStatus: null,
    lastVerifiedAt: null,
    confidence: "unknown",
    humanReviewStatus: "not-recorded",
    freshnessStatus: "unknown",
    evidenceCount: 0,
  },
  intelligence: null,
};

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

test("source v2 is deterministic and preserves compact canonical guidance", () => {
  const similarSources = [
    {
      profile: {
        ...listed,
        id: "source-three",
        slug: "source-three",
        name: "Source Three",
        url: "https://three.example",
      },
      differentiator: "Recorded task fit: Marketing pages.",
    },
    {
      profile: {
        ...listed,
        id: "source-four",
        slug: "source-four",
        name: "Source Four",
        url: "https://four.example",
      },
      differentiator: "Recorded capability: Design systems.",
    },
    {
      profile: {
        ...listed,
        id: "source-five",
        slug: "source-five",
        name: "Source Five",
        url: "https://five.example",
      },
      differentiator: "Recorded material: Source code.",
    },
  ];
  const first = createPublicSourceRepresentation(profiled, similarSources);
  const second = createPublicSourceRepresentation(profiled, similarSources);

  assert.equal(first.contract, PUBLIC_SOURCE_REPRESENTATION_CONTRACT);
  assert.equal(serializePublicJson(first), serializePublicJson(second));
  assert.equal(
    serializePublicSourceMarkdown(first),
    serializePublicSourceMarkdown(second),
  );
  assert.deepEqual(first.source, {
    id: profiled.id,
    slug: profiled.slug,
    name: profiled.name,
    purpose: profiled.summary,
    providerUrl: profiled.url,
    category: profiled.category,
    sourceType: profiled.sourceType,
    profileLevel: profiled.profileLevel,
    useWhen: profiled.bestFor,
    whatToExplore: ["inspiration", "components", "websites"],
    accessRoutes: profiled.accessRoutes,
    importantLimitations: ["No source code"],
    alternatives: [
      {
        slug: "source-three",
        name: "Source Three",
        canonicalPath: "/resources/source-three",
        providerUrl: "https://three.example",
        differentiator: "Recorded task fit: Marketing pages.",
      },
      {
        slug: "source-four",
        name: "Source Four",
        canonicalPath: "/resources/source-four",
        providerUrl: "https://four.example",
        differentiator: "Recorded capability: Design systems.",
      },
    ],
  });
  assert.equal(first.source.alternatives.length, 2);
  assert.deepEqual(first.diagnostics, {
    coverage: {
      level: "profiled",
      profileStatus: "verified",
      recordedVerifiedAt: "2026-07-01",
      confidence: "certain",
      freshnessStatus: "current",
    },
    evidenceCount: 1,
    governance: {
      defaultPersistence: "transient",
      assetRedistribution: "restricted",
      sourceAttribution: "required",
      userCredentialRequired: false,
      termsReviewRequired: true,
    },
  });

  const markdown = serializePublicSourceMarkdown(first);
  for (const heading of [
    "## Use it when",
    "## What to explore",
    "## How to access",
    "## Important limitations",
    "## Consider instead",
  ]) {
    assert.match(markdown, new RegExp(heading, "u"));
  }
  assert.equal(markdown.endsWith("\n"), true);
  assert.doesNotMatch(markdown, /[ \t]+$/gmu);
});

test("Listed source v2 fallback stays sparse and does not invent guidance", () => {
  const document = createPublicSourceRepresentation(listed);

  assert.deepEqual(document.source.useWhen, []);
  assert.deepEqual(document.source.whatToExplore, []);
  assert.deepEqual(document.source.accessRoutes, []);
  assert.deepEqual(document.source.importantLimitations, []);
  assert.deepEqual(document.source.alternatives, []);
  assert.equal(document.diagnostics, undefined);
  assert.match(
    serializePublicSourceMarkdown(document),
    /## How to access\n\nNone recorded/u,
  );
});

test("Collection v2 preserves ordered staged inspection and decision guidance", () => {
  const collection = {
    id: "collection-one",
    slug: "collection-one",
    title: "Landing-page direction",
    description: "A focused research path for a product landing page.",
    outcome: "Choose a direction to prototype.",
    audience: "Product teams.",
    status: "published",
    lastReviewedAt: "2026-08-01",
    resourceIds: ["source-two", "source-one"],
    stages: [
      {
        id: "baseline",
        title: "Establish a baseline",
        inspect: "Inspect hierarchy before visual treatment.",
        decision: "Choose the hierarchy to preserve.",
        resources: [
          { resource: { id: "source-two" }, role: "Establish the baseline." },
        ],
      },
      {
        id: "differentiate",
        title: "Find a differentiated direction",
        inspect: "Inspect component patterns and visual restraint.",
        decision: "Choose the direction to prototype.",
        resources: [
          { resource: { id: "source-one" }, role: "Test the richer option." },
        ],
      },
    ],
  };
  const document = createPublicCollectionRepresentation(collection, [
    profiled,
    listed,
  ]);

  assert.equal(document.contract, PUBLIC_COLLECTION_REPRESENTATION_CONTRACT);
  assert.deepEqual(document.collection, {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    outcome: collection.outcome,
    audience: collection.audience,
    stageCount: 2,
    resourceCount: 2,
    stages: [
      {
        order: 1,
        id: "baseline",
        title: "Establish a baseline",
        resources: [
          {
            order: 1,
            role: "Establish the baseline.",
            inspectPrompt: "Inspect hierarchy before visual treatment.",
            decisionPrompt: "Choose the hierarchy to preserve.",
            sourceGuide: {
              id: "source-two",
              slug: "source-two",
              name: "Source Two",
              canonicalPath: "/resources/source-two",
              jsonPath: "/resources/source-two/profile.json",
              markdownPath: "/resources/source-two/profile.md",
              providerUrl: "https://two.example",
            },
          },
        ],
      },
      {
        order: 2,
        id: "differentiate",
        title: "Find a differentiated direction",
        resources: [
          {
            order: 1,
            role: "Test the richer option.",
            inspectPrompt: "Inspect component patterns and visual restraint.",
            decisionPrompt: "Choose the direction to prototype.",
            sourceGuide: {
              id: "source-one",
              slug: "source-one",
              name: "Source One",
              canonicalPath: "/resources/source-one",
              jsonPath: "/resources/source-one/profile.json",
              markdownPath: "/resources/source-one/profile.md",
              providerUrl: "https://example.com",
              accessAction: browserAccess,
            },
          },
        ],
      },
    ],
  });
  const markdown = serializePublicCollectionMarkdown(document);
  assert.match(markdown, /# Tessli Collection — Landing-page direction/u);
  assert.match(markdown, /## Use this research path/u);
  assert.match(markdown, /## Staged decisions/u);
  assert.match(markdown, /\*\*Inspect:\*\* Inspect hierarchy/u);
  assert.match(markdown, /\*\*Decide:\*\* Choose the direction/u);
  assert.ok(
    markdown.indexOf("1. Establish a baseline") <
      markdown.indexOf("2. Find a differentiated direction"),
  );
  assert.doesNotMatch(markdown, /[ \t]+$/gmu);
});

test("public v2 output omits raw audit, intelligence, and private data", () => {
  const source = createPublicSourceRepresentation(profiled, [
    {
      profile: { ...listed, id: "source-three", slug: "source-three" },
      differentiator: "Recorded task fit: Marketing pages.",
    },
  ]);
  const collection = createPublicCollectionRepresentation(
    {
      id: "collection-one",
      slug: "collection-one",
      title: "One stage",
      description: "One stage only for this formatter test.",
      outcome: "Make one decision.",
      audience: "Builders.",
      stages: [
        {
          id: "inspect",
          title: "Inspect",
          inspect: "Inspect the source.",
          decision: "Make a decision.",
          resources: [{ resource: { id: "source-one" }, role: "Review it." }],
        },
      ],
    },
    [profiled],
  );
  const keys = collectKeys({ source, collection });

  for (const forbiddenKey of [
    "contractVersion",
    "verifiedAt",
    "evidence",
    "intelligence",
    "agentInterfaces",
    "discovery",
    "notes",
    "boardId",
    "boardIds",
    "savedIds",
    "localStorage",
    "cookie",
    "cookies",
    "account",
    "credential",
    "credentials",
  ]) {
    assert.equal(keys.has(forbiddenKey), false, forbiddenKey);
  }
  assert.doesNotMatch(
    serializePublicJson(source),
    /Raw governance notes|Intelligence summary|Recorded claim/u,
  );
  assert.equal(collection.playbook, undefined);
  assert.equal(collection.resources, undefined);
});

test("public headers remain readable, cacheable, indexable, and safe", () => {
  const headers = createPublicRepresentationHeaders({
    format: "json",
    filename: "tessli-source.json",
    canonicalPath: "/resources/source-one",
    jsonPath: "/resources/source-one/profile.json",
    markdownPath: "/resources/source-one/profile.md",
  });
  assert.equal(headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(headers["Access-Control-Allow-Origin"], "*");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Robots-Tag"], "index, follow");
  assert.match(headers["Cache-Control"], /s-maxage=86400/u);
  assert.match(headers.Link, /rel="canonical"/u);
  assert.deepEqual(createPublicOptionsHeaders(), {
    Allow: "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  });
});

test("formatter has no clock, network, storage, cookie, or environment dependency", async () => {
  const source = await readFile(
    new URL("../lib/public-representations.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /Date\.now\(|new Date\(|fetch\(|XMLHttpRequest|localStorage|cookies\(|process\.env/u,
  );
});
