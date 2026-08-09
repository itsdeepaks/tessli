import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import catalogue from "../data/catalogue.json" with { type: "json" };
import {
  ACCESS_ROUTE_KINDS,
  ACCESS_ROUTE_PILOT_SOURCE_IDS,
} from "../data/access-route-pilot.ts";
import { getNativeResourceProfile } from "../lib/mcp-native-tools.ts";
import { createPublicSourceRepresentation } from "../lib/public-representations.mjs";
import {
  SOURCE_PROFILE_CONTRACT_VERSION,
  SOURCE_PROFILE_REVIEWED_AT,
  SOURCE_TYPE_BY_CATEGORY,
  deriveCoverageLevel,
  getAllSourceProfiles,
  getSourceContractSummary,
  getSourceCoverageCounts,
  getSourceProfile,
} from "../lib/source-profiles.ts";
import { validateSourceProfileContract } from "../scripts/check-source-profile-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(
  __dirname,
  "../../schemas/source-profile.schema.json",
);

const batch13Identifiers = [
  "google-fonts",
  "radix-ui",
  "headless-ui",
  "react-aria",
  "gsap",
  "lottiefiles",
  "rive",
  "spline",
  "react-three-fiber",
  "lucide",
];

const batch14Identifiers = [
  "fonts-in-use",
  "font-squirrel",
  "free-faces",
  "open-foundry",
  "fontpair",
  "velvetyne",
  "adobe-fonts",
  "theatre-js",
  "anime-js",
  "autoanimate",
];

const expandedBatchIdentifiers = [...batch13Identifiers, ...batch14Identifiers];

const requiredSourceFields = [
  "id",
  "slug",
  "name",
  "url",
  "domain",
  "summary",
  "category",
  "sourceType",
  "accessModel",
  "bestFor",
  "capabilities",
  "contentObjects",
  "platforms",
  "frameworks",
  "integrationMethods",
  "accessRoutes",
  "limitations",
  "profileLevel",
  "status",
  "verifiedAt",
  "evidence",
];

test("source profile schema defines the complete canonical v1 contract", () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(
    schema.$id,
    "https://tessli.dev/schemas/source-profile.schema.json",
  );
  assert.equal(
    schema.properties.contractVersion.const,
    SOURCE_PROFILE_CONTRACT_VERSION,
  );
  for (const field of requiredSourceFields) {
    assert.ok(
      schema.required.includes(field),
      `Missing required field ${field}`,
    );
    assert.ok(schema.properties[field], `Missing property schema ${field}`);
  }
  assert.deepEqual(schema.properties.profileLevel.enum, [
    "listed",
    "profiled",
    "verified",
  ]);
  assert.equal(SOURCE_PROFILE_REVIEWED_AT, "2026-08-05");
});

test("all 295 catalogue resources have one deterministic source profile", () => {
  const profiles = getAllSourceProfiles();
  assert.equal(profiles.length, 295);
  assert.equal(profiles.length, catalogue.resources.length);
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, 295);
  assert.equal(new Set(profiles.map((profile) => profile.slug)).size, 295);

  for (const resource of catalogue.resources) {
    const profile = getSourceProfile(resource.id);
    assert.ok(profile);
    assert.equal(profile.slug, resource.slug);
    assert.equal(getSourceProfile(resource.slug)?.id, resource.id);
    assert.equal(profile.name, resource.name);
    assert.equal(profile.url, resource.url);
    assert.equal(profile.domain, resource.domain);
    assert.equal(profile.summary, resource.description);
    assert.equal(profile.category, resource.category);
    assert.deepEqual(profile.accessModel, {
      access: resource.access,
      subscriptionRequired: resource.subscriptionRequired,
    });
  }
});

test("AccessRoute is canonical for exactly ten recorded pilot sources and honest for the other 285", () => {
  assert.equal(ACCESS_ROUTE_PILOT_SOURCE_IDS.length, 10);
  assert.equal(new Set(ACCESS_ROUTE_PILOT_SOURCE_IDS).size, 10);

  const pilotProfiles = getAllSourceProfiles().filter((profile) =>
    ACCESS_ROUTE_PILOT_SOURCE_IDS.includes(profile.id),
  );
  const fallbackProfiles = getAllSourceProfiles().filter(
    (profile) => !ACCESS_ROUTE_PILOT_SOURCE_IDS.includes(profile.id),
  );
  assert.equal(pilotProfiles.length, 10);
  assert.equal(fallbackProfiles.length, 285);

  const pilotKinds = new Set(
    pilotProfiles.flatMap((profile) =>
      profile.accessRoutes.map((route) => route.kind),
    ),
  );
  for (const kind of [
    "browser",
    "documentation",
    "package-registry",
    "source-code",
    "api",
    "mcp",
    "cli",
  ]) {
    assert.ok(pilotKinds.has(kind), `Missing ${kind} pilot route.`);
  }

  for (const profile of getAllSourceProfiles()) {
    assert.equal(
      profile.accessRoutes.filter((route) => route.preferred).length,
      1,
      `${profile.id} must declare exactly one preferred route`,
    );
    for (const route of profile.accessRoutes) {
      assert.ok(ACCESS_ROUTE_KINDS.includes(route.kind));
      assert.ok(["none", "user", "unknown"].includes(route.auth));
      assert.ok(route.agentAction.length > 0);
    }
  }

  for (const profile of fallbackProfiles) {
    assert.deepEqual(profile.accessRoutes, [
      {
        kind: "browser",
        url: profile.url,
        preferred: true,
        auth: "unknown",
        agentAction:
          "Open the canonical provider URL; sign-in and other access requirements are not recorded.",
      },
    ]);
  }
});

test("coverage baseline is truthful: 255 Listed, 40 Profiled, 0 Verified", () => {
  assert.deepEqual(getSourceCoverageCounts(), {
    listed: 255,
    profiled: 40,
    verified: 0,
  });
  assert.deepEqual(getSourceContractSummary(), {
    contractVersion: 1,
    reviewedAt: "2026-08-05",
    resourceCount: 295,
    intelligenceProfileCount: 40,
    coverageCounts: {
      listed: 255,
      profiled: 40,
      verified: 0,
    },
  });
});

test("Profiled records expose normalized intelligence without losing evidence", () => {
  const relume = getSourceProfile("relume");
  assert.ok(relume?.intelligence);
  assert.equal(relume.intelligence.status, "verified");
  assert.equal(relume.profileLevel, "profiled");
  assert.equal(relume.coverage.level, "profiled");
  assert.equal(relume.coverage.humanReviewStatus, "not-recorded");
  assert.equal(relume.verifiedAt, "2026-07-31");
  assert.equal(relume.coverage.freshnessStatus, "current");
  assert.equal(relume.coverage.confidence, "certain");
  assert.deepEqual(relume.bestFor, relume.intelligence.workflowFit);
  assert.deepEqual(relume.capabilities, relume.intelligence.capabilities);
  assert.deepEqual(relume.contentObjects, relume.intelligence.contentObjects);
  assert.deepEqual(relume.platforms, relume.intelligence.platforms);
  assert.deepEqual(relume.frameworks, relume.intelligence.frameworks);
  assert.deepEqual(
    relume.integrationMethods,
    relume.intelligence.integrationMethods,
  );
  assert.deepEqual(relume.limitations, relume.intelligence.limitations);
  assert.deepEqual(relume.evidence, relume.intelligence.evidence);
  assert.equal(
    deriveCoverageLevel(relume.intelligence, "completed"),
    "verified",
  );
});

test("expanded batch records are complete Profiled sources without invented verification", () => {
  for (const identifier of expandedBatchIdentifiers) {
    const profile = getSourceProfile(identifier);
    assert.ok(profile?.intelligence, `${identifier} must have intelligence`);
    assert.equal(profile.profileLevel, "profiled");
    assert.equal(profile.coverage.level, "profiled");
    assert.equal(profile.coverage.profileStatus, "needs-review");
    assert.equal(profile.coverage.humanReviewStatus, "not-recorded");
    assert.equal(profile.coverage.freshnessStatus, "current");
    assert.equal(profile.coverage.confidence, "certain");
    assert.equal(profile.verifiedAt, "2026-08-05");
    assert.ok(profile.bestFor.length > 0);
    assert.ok(profile.capabilities.length > 0);
    assert.ok(profile.contentObjects.length > 0);
    assert.ok(profile.limitations.length > 0);
    assert.ok(profile.evidence.length > 0);
  }
});

test("Listed records expose no invented intelligence, evidence, or timestamps", () => {
  const listed = getAllSourceProfiles().filter(
    (profile) => profile.profileLevel === "listed",
  );
  assert.equal(listed.length, 255);
  for (const profile of listed) {
    assert.equal(profile.intelligence, null);
    assert.deepEqual(profile.bestFor, []);
    assert.deepEqual(profile.capabilities, []);
    assert.deepEqual(profile.contentObjects, []);
    assert.deepEqual(profile.platforms, []);
    assert.deepEqual(profile.frameworks, []);
    assert.deepEqual(profile.integrationMethods, []);
    assert.deepEqual(profile.limitations, []);
    assert.deepEqual(profile.evidence, []);
    assert.equal(profile.verifiedAt, null);
    assert.equal(profile.coverage.profileStatus, null);
    assert.equal(profile.coverage.lastVerifiedAt, null);
    assert.equal(profile.coverage.confidence, "unknown");
    assert.equal(profile.coverage.freshnessStatus, "unknown");
    assert.equal(profile.coverage.humanReviewStatus, "not-recorded");
    assert.equal(profile.coverage.evidenceCount, 0);
  }
});

test("source type is a deterministic category classification, not provider fact", () => {
  assert.equal(Object.keys(SOURCE_TYPE_BY_CATEGORY).length, 11);
  for (const profile of getAllSourceProfiles()) {
    assert.equal(profile.sourceType, SOURCE_TYPE_BY_CATEGORY[profile.category]);
    assert.equal(profile.sourceTypeBasis, "category-classification");
  }
});

test("website-ready source profiles and MCP preserve the same source identity", () => {
  for (const identifier of ["relume", ...expandedBatchIdentifiers]) {
    const sourceProfile = getSourceProfile(identifier);
    const nativeProfile = getNativeResourceProfile(identifier);
    assert.ok(sourceProfile);
    assert.equal(nativeProfile.resource.id, sourceProfile.id);
    assert.equal(nativeProfile.resource.slug, sourceProfile.slug);
    assert.equal(
      nativeProfile.intelligenceProfile?.resourceId,
      sourceProfile.intelligence?.resourceId,
    );
  }
});

test("website profiles, public representations, and local MCP share exact AccessRoute values", () => {
  for (const identifier of ["landingfolio", "google-fonts", "designindex"]) {
    const sourceProfile = getSourceProfile(identifier);
    assert.ok(sourceProfile);
    const publicRepresentation =
      createPublicSourceRepresentation(sourceProfile);
    const nativeProfile = getNativeResourceProfile(identifier);

    assert.deepEqual(
      publicRepresentation.source.accessRoutes,
      sourceProfile.accessRoutes,
    );
    assert.deepEqual(
      nativeProfile.resource.accessRoutes,
      sourceProfile.accessRoutes,
    );
  }
});

test("source profile validator accepts the complete deterministic baseline", () => {
  const report = validateSourceProfileContract();
  assert.equal(report.valid, true, JSON.stringify(report.errors, null, 2));
  assert.equal(report.resourceCount, 295);
  assert.equal(report.intelligenceProfileCount, 40);
  assert.deepEqual(report.coverageCounts, {
    listed: 255,
    profiled: 40,
    verified: 0,
  });
});
