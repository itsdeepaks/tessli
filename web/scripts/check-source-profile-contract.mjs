import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import catalogue from "../data/catalogue.json" with { type: "json" };
import {
  ACCESS_ROUTE_PILOT_SOURCE_IDS,
  ACCESS_ROUTE_KINDS,
} from "../data/access-route-pilot.ts";
import {
  SOURCE_PROFILE_CONTRACT_VERSION,
  SOURCE_PROFILE_REVIEWED_AT,
  SOURCE_TYPES,
  getAllSourceProfiles,
  getSourceContractSummary,
  getSourceProfile,
} from "../lib/source-profiles.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(
  __dirname,
  "../../schemas/source-profile.schema.json",
);
const SOURCE_PROFILE_SCHEMA_ID =
  "https://tessli.dev/schemas/source-profile.schema.json";

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function validIsoDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  );
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function expectedSourceStatus(status) {
  return status === "active" || status === "inactive" ? status : "unknown";
}

export function validateSourceProfileContract() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const profiles = [...getAllSourceProfiles()];
  const summary = getSourceContractSummary();
  const errors = [];

  if (schema.$id !== SOURCE_PROFILE_SCHEMA_ID) {
    errors.push(
      issue("schema-id", "Source profile schema ID is not canonical."),
    );
  }
  if (
    schema.properties?.contractVersion?.const !==
    SOURCE_PROFILE_CONTRACT_VERSION
  ) {
    errors.push(
      issue(
        "schema-version",
        "Source profile schema version does not match the runtime contract.",
      ),
    );
  }
  if (!validIsoDate(SOURCE_PROFILE_REVIEWED_AT)) {
    errors.push(
      issue("reviewed-at", "Source profile contract review date is invalid."),
    );
  }

  if (profiles.length !== catalogue.resources.length) {
    errors.push(
      issue(
        "resource-count",
        "Source profile count does not match the canonical catalogue.",
        { expected: catalogue.resources.length, actual: profiles.length },
      ),
    );
  }

  const ids = new Set();
  const slugs = new Set();
  const allowedSourceTypes = new Set(SOURCE_TYPES);
  const accessRouteKinds = new Set(ACCESS_ROUTE_KINDS);
  const catalogueById = new Map(
    catalogue.resources.map((resource) => [resource.id, resource]),
  );

  for (const profile of profiles) {
    const catalogueResource = catalogueById.get(profile.id);
    if (!catalogueResource) {
      errors.push(
        issue(
          "unknown-resource",
          `Unknown source profile resource: ${profile.id}.`,
        ),
      );
      continue;
    }

    if (ids.has(profile.id)) {
      errors.push(
        issue("duplicate-id", `Duplicate source profile ID: ${profile.id}.`),
      );
    }
    if (slugs.has(profile.slug)) {
      errors.push(
        issue(
          "duplicate-slug",
          `Duplicate source profile slug: ${profile.slug}.`,
        ),
      );
    }
    ids.add(profile.id);
    slugs.add(profile.slug);

    for (const key of ["slug", "name", "url", "domain", "category"]) {
      if (profile[key] !== catalogueResource[key]) {
        errors.push(
          issue(
            "catalogue-drift",
            `${profile.id} does not preserve catalogue field ${key}.`,
          ),
        );
      }
    }

    if (profile.summary !== catalogueResource.description) {
      errors.push(
        issue(
          "summary-drift",
          `${profile.id} does not preserve its catalogue description as summary.`,
        ),
      );
    }
    if (
      profile.accessModel.access !== catalogueResource.access ||
      profile.accessModel.subscriptionRequired !==
        catalogueResource.subscriptionRequired
    ) {
      errors.push(
        issue(
          "access-model",
          `${profile.id} does not preserve its catalogue access model.`,
        ),
      );
    }
    if (profile.status !== expectedSourceStatus(catalogueResource.status)) {
      errors.push(
        issue(
          "source-status",
          `${profile.id} does not preserve its catalogue availability status.`,
        ),
      );
    }

    if (!allowedSourceTypes.has(profile.sourceType)) {
      errors.push(
        issue(
          "source-type",
          `${profile.id} has unsupported source type ${profile.sourceType}.`,
        ),
      );
    }
    if (profile.sourceTypeBasis !== "category-classification") {
      errors.push(
        issue(
          "source-type-basis",
          `${profile.id} has an unsupported source type basis.`,
        ),
      );
    }
    if (
      !Array.isArray(profile.accessRoutes) ||
      profile.accessRoutes.length === 0
    ) {
      errors.push(issue("access-routes", `${profile.id} has no access route.`));
    } else {
      const preferredRoutes = profile.accessRoutes.filter(
        (route) => route.preferred,
      );
      if (preferredRoutes.length !== 1) {
        errors.push(
          issue(
            "access-route-preferred",
            `${profile.id} must have exactly one preferred access route.`,
          ),
        );
      }
      for (const route of profile.accessRoutes) {
        if (
          !accessRouteKinds.has(route.kind) ||
          !["none", "user", "unknown"].includes(route.auth) ||
          !route.agentAction.trim()
        ) {
          errors.push(
            issue(
              "access-route-shape",
              `${profile.id} has an invalid access route.`,
            ),
          );
        }
      }
    }
    if (profile.profileLevel !== profile.coverage.level) {
      errors.push(
        issue(
          "profile-level",
          `${profile.id} profile level does not match its coverage record.`,
        ),
      );
    }

    if (profile.profileLevel === "listed" && profile.intelligence !== null) {
      errors.push(
        issue(
          "listed-has-intelligence",
          `${profile.id} is Listed despite having intelligence data.`,
        ),
      );
    }
    if (profile.profileLevel !== "listed" && profile.intelligence === null) {
      errors.push(
        issue(
          "profile-missing-intelligence",
          `${profile.id} has ${profile.profileLevel} coverage without intelligence data.`,
        ),
      );
    }

    if (profile.intelligence) {
      const intelligence = profile.intelligence;
      if (
        intelligence.resourceId !== profile.id &&
        intelligence.resourceId !== profile.slug
      ) {
        errors.push(
          issue(
            "intelligence-link",
            `${profile.id} is linked to unrelated intelligence ID ${intelligence.resourceId}.`,
          ),
        );
      }

      const normalizedFields = [
        ["bestFor", intelligence.workflowFit],
        ["capabilities", intelligence.capabilities],
        ["contentObjects", intelligence.contentObjects],
        ["platforms", intelligence.platforms],
        ["frameworks", intelligence.frameworks],
        ["integrationMethods", intelligence.integrationMethods],
        ["limitations", intelligence.limitations],
        ["evidence", intelligence.evidence],
      ];
      for (const [field, expected] of normalizedFields) {
        if (!sameValue(profile[field], expected)) {
          errors.push(
            issue(
              "intelligence-normalization",
              `${profile.id} does not preserve intelligence field ${field}.`,
            ),
          );
        }
      }

      if (profile.verifiedAt !== intelligence.verifiedAt) {
        errors.push(
          issue(
            "verification-date",
            `${profile.id} verification date does not match its intelligence profile.`,
          ),
        );
      }
      if (profile.coverage.evidenceCount !== intelligence.evidence.length) {
        errors.push(
          issue(
            "evidence-count",
            `${profile.id} evidence count does not match its intelligence profile.`,
          ),
        );
      }
      if (profile.coverage.lastVerifiedAt !== intelligence.verifiedAt) {
        errors.push(
          issue(
            "coverage-verification-date",
            `${profile.id} coverage date does not match its intelligence profile.`,
          ),
        );
      }
      if (
        profile.profileLevel === "verified" &&
        profile.coverage.humanReviewStatus !== "completed"
      ) {
        errors.push(
          issue(
            "verified-without-review",
            `${profile.id} is Verified without an explicit human-review record.`,
          ),
        );
      }
    } else {
      for (const field of [
        "bestFor",
        "capabilities",
        "contentObjects",
        "platforms",
        "frameworks",
        "integrationMethods",
        "limitations",
        "evidence",
      ]) {
        if (!Array.isArray(profile[field]) || profile[field].length !== 0) {
          errors.push(
            issue(
              "listed-intelligence",
              `${profile.id} invents ${field} without an intelligence profile.`,
            ),
          );
        }
      }
      if (
        profile.verifiedAt !== null ||
        profile.coverage.evidenceCount !== 0 ||
        profile.coverage.lastVerifiedAt !== null ||
        profile.coverage.confidence !== "unknown" ||
        profile.coverage.freshnessStatus !== "unknown" ||
        profile.coverage.humanReviewStatus !== "not-recorded"
      ) {
        errors.push(
          issue(
            "listed-evidence",
            `${profile.id} exposes verification claims without an intelligence profile.`,
          ),
        );
      }
    }

    if (getSourceProfile(profile.id)?.slug !== profile.slug) {
      errors.push(
        issue("id-lookup", `${profile.id} does not resolve by stable ID.`),
      );
    }
    if (getSourceProfile(profile.slug)?.id !== profile.id) {
      errors.push(
        issue("slug-lookup", `${profile.id} does not resolve by slug.`),
      );
    }
  }

  const coverageTotal = Object.values(summary.coverageCounts).reduce(
    (total, count) => total + count,
    0,
  );
  if (coverageTotal !== profiles.length) {
    errors.push(
      issue(
        "coverage-total",
        "Coverage counts do not account for every source profile.",
      ),
    );
  }
  if (summary.intelligenceProfileCount !== 40) {
    errors.push(
      issue(
        "intelligence-count",
        "The reviewed intelligence dataset must contain exactly 40 profiles after Slice 1.4.",
        { actual: summary.intelligenceProfileCount },
      ),
    );
  }
  if (ACCESS_ROUTE_PILOT_SOURCE_IDS.length !== 10) {
    errors.push(
      issue(
        "access-route-pilot-size",
        "AccessRoute pilot must contain exactly ten sources.",
      ),
    );
  }
  if (
    summary.coverageCounts.listed !== 255 ||
    summary.coverageCounts.profiled !== 40 ||
    summary.coverageCounts.verified !== 0
  ) {
    errors.push(
      issue(
        "coverage-composition",
        "Coverage composition is not the truthful Slice 1.4 baseline.",
        { actual: summary.coverageCounts },
      ),
    );
  }

  return {
    valid: errors.length === 0,
    contractVersion: SOURCE_PROFILE_CONTRACT_VERSION,
    reviewedAt: SOURCE_PROFILE_REVIEWED_AT,
    resourceCount: profiles.length,
    intelligenceProfileCount: summary.intelligenceProfileCount,
    coverageCounts: summary.coverageCounts,
    errors,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = validateSourceProfileContract();
  console.log(
    `Source profile contract: ${report.resourceCount} resources; ` +
      `${report.coverageCounts.listed} Listed, ` +
      `${report.coverageCounts.profiled} Profiled, ` +
      `${report.coverageCounts.verified} Verified.`,
  );

  if (!report.valid) {
    for (const error of report.errors) {
      console.error(` - [${error.code}] ${error.message}`);
    }
    process.exit(1);
  }
}
