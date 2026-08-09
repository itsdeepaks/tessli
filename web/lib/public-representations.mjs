export const PUBLIC_SOURCE_REPRESENTATION_CONTRACT = "tessli.public-source.v2";
export const PUBLIC_COLLECTION_REPRESENTATION_CONTRACT =
  "tessli.public-collection.v2";

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLineEndings(value) {
  return String(value ?? "").replace(/\r\n?/gu, "\n");
}

function inline(value, fallback = "Not recorded") {
  const normalized = normalizeLineEndings(value)
    .trim()
    .replace(/\s*\n\s*/gu, " ");
  return normalized || fallback;
}

function markdown(lines) {
  return `${lines
    .flatMap((line) => normalizeLineEndings(line).split("\n"))
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .replace(/\n+$/gu, "")}\n`;
}

function pushList(lines, title, values) {
  lines.push(`## ${title}`, "");
  if (!Array.isArray(values) || values.length === 0) {
    lines.push("None recorded", "");
    return;
  }
  for (const value of values) lines.push(`- ${inline(value)}`);
  lines.push("");
}

function uniqueRecordedStrings(values) {
  const seen = new Set();
  const unique = [];

  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const key = value.trim().toLocaleLowerCase("en");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }

  return unique;
}

function publicAccessRoutes(routes) {
  return Array.isArray(routes) ? routes.map((route) => ({ ...route })) : [];
}

function publicAlternatives(profile, similarSources) {
  if (!Array.isArray(similarSources)) return [];

  const seen = new Set();
  const alternatives = [];
  for (const match of similarSources) {
    const alternative = match?.profile;
    if (
      !isPlainObject(alternative) ||
      alternative.id === profile.id ||
      typeof alternative.slug !== "string" ||
      typeof alternative.name !== "string" ||
      typeof alternative.url !== "string" ||
      typeof match.differentiator !== "string" ||
      !match.differentiator.trim() ||
      seen.has(alternative.id)
    ) {
      continue;
    }
    seen.add(alternative.id);
    alternatives.push({
      slug: alternative.slug,
      name: alternative.name,
      canonicalPath: `/resources/${alternative.slug}`,
      providerUrl: alternative.url,
      differentiator: match.differentiator,
    });
    if (alternatives.length === 2) break;
  }
  return alternatives;
}

function publicDiagnostics(profile) {
  if (profile.profileLevel === "listed" || !isPlainObject(profile.coverage)) {
    return null;
  }

  const coverage = profile.coverage;
  const governance = profile.intelligence?.governance;
  const diagnostics = {
    coverage: {
      level: coverage.level,
      ...(coverage.profileStatus
        ? { profileStatus: coverage.profileStatus }
        : {}),
      ...(coverage.lastVerifiedAt
        ? { recordedVerifiedAt: coverage.lastVerifiedAt }
        : {}),
      ...(coverage.confidence && coverage.confidence !== "unknown"
        ? { confidence: coverage.confidence }
        : {}),
      ...(coverage.humanReviewStatus !== "not-recorded"
        ? { humanReviewStatus: coverage.humanReviewStatus }
        : {}),
      ...(coverage.freshnessStatus && coverage.freshnessStatus !== "unknown"
        ? { freshnessStatus: coverage.freshnessStatus }
        : {}),
    },
    ...(typeof coverage.evidenceCount === "number" && coverage.evidenceCount > 0
      ? { evidenceCount: coverage.evidenceCount }
      : {}),
  };

  if (isPlainObject(governance)) {
    diagnostics.governance = {
      ...(governance.defaultPersistence
        ? { defaultPersistence: governance.defaultPersistence }
        : {}),
      ...(governance.assetRedistribution
        ? { assetRedistribution: governance.assetRedistribution }
        : {}),
      ...(governance.sourceAttribution
        ? { sourceAttribution: governance.sourceAttribution }
        : {}),
      ...(typeof governance.userCredentialRequired === "boolean"
        ? { userCredentialRequired: governance.userCredentialRequired }
        : {}),
      ...(typeof governance.termsReviewRequired === "boolean"
        ? { termsReviewRequired: governance.termsReviewRequired }
        : {}),
    };
  }

  return diagnostics;
}

/**
 * Creates a compact, action-first public guide from canonical SourceProfile
 * truth and optionally supplied deterministic Similar Source matches.
 */
export function createPublicSourceRepresentation(profile, similarSources = []) {
  if (!isPlainObject(profile) || typeof profile.slug !== "string") {
    throw new TypeError("A canonical Tessli SourceProfile is required.");
  }
  const canonicalPath = `/resources/${profile.slug}`;
  const jsonPath = `${canonicalPath}/profile.json`;
  const markdownPath = `${canonicalPath}/profile.md`;
  const diagnostics = publicDiagnostics(profile);

  return {
    contract: PUBLIC_SOURCE_REPRESENTATION_CONTRACT,
    canonicalPath,
    representations: { json: jsonPath, markdown: markdownPath },
    source: {
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      purpose: profile.summary,
      providerUrl: profile.url,
      category: profile.category,
      sourceType: profile.sourceType,
      profileLevel: profile.profileLevel,
      useWhen: uniqueRecordedStrings(profile.bestFor),
      whatToExplore: uniqueRecordedStrings([
        ...(profile.capabilities ?? []),
        ...(profile.contentObjects ?? []),
      ]),
      accessRoutes: publicAccessRoutes(profile.accessRoutes),
      importantLimitations: uniqueRecordedStrings(profile.limitations),
      alternatives: publicAlternatives(profile, similarSources),
    },
    ...(diagnostics ? { diagnostics } : {}),
    boundaries: [
      "Repository intelligence is not live-provider verification.",
      "Revalidate provider access, pricing, licensing, terms, availability, and time-sensitive claims.",
      "Tessli classifications are research guidance, not provider claims or universal rankings.",
      "No browser-local Board, Saved, account, cookie, or credential data is included.",
    ],
  };
}

function sourceGuide(profile) {
  const canonicalPath = `/resources/${profile.slug}`;
  const preferredRoute = (profile.accessRoutes ?? []).find(
    (route) => route.preferred,
  );
  const route = preferredRoute ?? profile.accessRoutes?.[0];

  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    canonicalPath,
    jsonPath: `${canonicalPath}/profile.json`,
    markdownPath: `${canonicalPath}/profile.md`,
    providerUrl: profile.url,
    ...(route ? { accessAction: { ...route } } : {}),
  };
}

/**
 * Creates a compact Collection checklist from a published Collection and the
 * canonical SourceProfiles it references.
 */
export function createPublicCollectionRepresentation(
  collection,
  sourceProfiles,
) {
  if (!isPlainObject(collection) || typeof collection.slug !== "string") {
    throw new TypeError("A published Tessli Collection is required.");
  }
  const byId = new Map(sourceProfiles.map((profile) => [profile.id, profile]));
  let resourceCount = 0;
  const stages = collection.stages.map((stage, stageIndex) => ({
    order: stageIndex + 1,
    id: stage.id,
    title: stage.title,
    resources: stage.resources.map((item, itemIndex) => {
      const resourceId = item.resource?.id ?? item.resourceId;
      const profile = byId.get(resourceId);
      if (!profile) {
        throw new Error(
          `Collection ${collection.slug} references missing source ${resourceId}.`,
        );
      }
      resourceCount += 1;
      return {
        order: itemIndex + 1,
        role: item.role,
        inspectPrompt: stage.inspect,
        decisionPrompt: stage.decision,
        sourceGuide: sourceGuide(profile),
      };
    }),
  }));
  const canonicalPath = `/collections/${collection.slug}`;
  const jsonPath = `${canonicalPath}/collection.json`;
  const markdownPath = `${canonicalPath}/collection.md`;

  return {
    contract: PUBLIC_COLLECTION_REPRESENTATION_CONTRACT,
    canonicalPath,
    representations: { json: jsonPath, markdown: markdownPath },
    collection: {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      outcome: collection.outcome,
      audience: collection.audience,
      stageCount: stages.length,
      resourceCount,
      stages,
    },
    boundaries: [
      "Collection order is editorial guidance and does not represent popularity, sponsorship, or universal quality.",
      "Repository intelligence is not live-provider verification.",
      "Revalidate provider access, pricing, licensing, terms, availability, and time-sensitive claims.",
      "No browser-local Board, Saved, account, cookie, or credential data is included.",
    ],
  };
}

export function serializePublicJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializePublicSourceMarkdown(document) {
  const source = document.source;
  const lines = [
    `# Tessli Source Guide — ${inline(source.name)}`,
    "",
    `Use this source to ${inline(source.purpose)}`,
    "",
    `Tessli guide: ${document.canonicalPath}`,
    `Provider: ${inline(source.providerUrl)}`,
    "",
  ];
  pushList(lines, "Use it when", source.useWhen);
  pushList(lines, "What to explore", source.whatToExplore);
  lines.push("## How to access", "");
  if (source.accessRoutes.length === 0) {
    lines.push("None recorded", "");
  } else {
    for (const route of source.accessRoutes) {
      lines.push(
        `- **${inline(route.kind)}${route.preferred ? " (preferred)" : ""}:** ${inline(route.agentAction)} Auth: ${inline(route.auth)}.${route.url ? ` (${inline(route.url)})` : ""}`,
      );
    }
    lines.push("");
  }
  pushList(lines, "Important limitations", source.importantLimitations);
  lines.push("## Consider instead", "");
  if (source.alternatives.length === 0) {
    lines.push("None recorded", "");
  } else {
    for (const alternative of source.alternatives) {
      lines.push(
        `- **${inline(alternative.name)}:** ${inline(alternative.differentiator)} Tessli guide: ${inline(alternative.canonicalPath)}. Provider: ${inline(alternative.providerUrl)}.`,
      );
    }
    lines.push("");
  }
  lines.push("## Interpretation boundaries", "");
  for (const boundary of document.boundaries) {
    lines.push(`- ${inline(boundary)}`);
  }
  lines.push("");
  return markdown(lines);
}

export function serializePublicCollectionMarkdown(document) {
  const collection = document.collection;
  const lines = [
    `# Tessli Collection — ${inline(collection.title)}`,
    "",
    "## Use this research path",
    "",
    `Use this research path to ${inline(collection.outcome)}`,
    "",
    inline(collection.description),
    "",
    `- **Audience:** ${inline(collection.audience)}`,
    `- **Stages:** ${collection.stageCount}`,
    `- **Sources:** ${collection.resourceCount}`,
    "",
    "## Staged decisions",
    "",
  ];

  for (const stage of collection.stages) {
    lines.push(`### ${stage.order}. ${inline(stage.title)}`, "");
    for (const resource of stage.resources) {
      const guide = resource.sourceGuide;
      lines.push(
        `#### ${stage.order}.${resource.order} ${inline(guide.name)}`,
        "",
        `- **Role:** ${inline(resource.role)}`,
        `- **Inspect:** ${inline(resource.inspectPrompt)}`,
        `- **Decide:** ${inline(resource.decisionPrompt)}`,
        `- **Source guide:** ${inline(guide.canonicalPath)}`,
        `- **JSON:** ${inline(guide.jsonPath)}`,
        `- **Markdown:** ${inline(guide.markdownPath)}`,
        `- **Provider:** ${inline(guide.providerUrl)}`,
      );
      if (guide.accessAction) {
        lines.push(
          `- **Access action:** ${inline(guide.accessAction.agentAction)}${guide.accessAction.url ? ` (${inline(guide.accessAction.url)})` : ""}`,
        );
      }
      lines.push("");
    }
  }

  lines.push("## Interpretation boundaries", "");
  for (const boundary of document.boundaries) {
    lines.push(`- ${inline(boundary)}`);
  }
  lines.push("");
  return markdown(lines);
}

export function createPublicRepresentationHeaders({
  format,
  filename,
  canonicalPath,
  jsonPath,
  markdownPath,
}) {
  const contentType =
    format === "json"
      ? "application/json; charset=utf-8"
      : "text/markdown; charset=utf-8";
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": CACHE_CONTROL,
    "Content-Disposition": `inline; filename="${filename}"`,
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "cross-origin",
    Link: `<${canonicalPath}>; rel="canonical"; type="text/html", <${jsonPath}>; rel="alternate"; type="application/json", <${markdownPath}>; rel="alternate"; type="text/markdown"`,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "index, follow",
  };
}

export function createPublicOptionsHeaders() {
  return {
    Allow: "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  };
}
