import type { AccessRoute } from "../data/access-route-pilot.ts";
import {
  getSimilarSourceProfiles,
  type SimilarSourceMatch,
} from "./similar-sources.ts";
import { getAllSourceProfiles, type SourceProfile } from "./source-profiles.ts";

export const MAX_TASK_RETRIEVAL_RESULTS = 8 as const;

export class TaskRetrievalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskRetrievalInputError";
  }
}

export interface TaskRetrievalInput {
  task: string;
  surface?: string;
  framework?: string;
  needs?: readonly string[];
  exclusions?: readonly string[];
}

export interface NormalizedTaskRetrievalInput {
  task: string;
  surface: string | null;
  framework: string | null;
  needs: readonly string[];
  exclusions: readonly string[];
}

export interface TaskRetrievalAlternative {
  id: string;
  slug: string;
  name: string;
  url: string;
  differentiator: string;
}

export interface TaskSourceChoice {
  id: string;
  slug: string;
  name: string;
  url: string;
  summary: string;
  profileLevel: SourceProfile["profileLevel"];
  fitReasons: readonly string[];
  caveats: readonly string[];
  coverageNote: string;
  accessRoutes: readonly AccessRoute[];
  alternatives: readonly TaskRetrievalAlternative[];
}

export interface TaskRetrievalResult {
  input: NormalizedTaskRetrievalInput;
  sources: readonly TaskSourceChoice[];
}

type MetadataField = {
  label: string;
  values: readonly string[];
  weight: number;
};

type RankedCandidate = {
  profile: SourceProfile;
  score: number;
  fitReasons: readonly string[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
  "build",
  "design",
  "find",
  "need",
  "using",
]);

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[\s_-]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value ? normalizeText(value) : "";
  return normalized || null;
}

function normalizeList(
  values: readonly string[] | undefined,
): readonly string[] {
  if (!values) return [];

  return Array.from(
    new Set(values.map(normalizeText).filter((value) => value.length > 0)),
  ).sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toTaskTerms(task: string): readonly string[] {
  return Array.from(
    new Set(
      task
        .split(" ")
        .filter((term) => term.length > 1 && !STOP_WORDS.has(term)),
    ),
  );
}

function includesPhrase(value: string, phrase: string): boolean {
  const phraseTerms = phrase.split(" ").filter(Boolean);
  if (phraseTerms.length === 0) return false;

  const normalizedValue = normalizeText(value);
  return phraseTerms.every((term) => normalizedValue.includes(term));
}

function metadataFields(profile: SourceProfile): readonly MetadataField[] {
  return [
    {
      label: "source identity",
      values: [profile.name, profile.slug],
      weight: 8,
    },
    { label: "summary", values: [profile.summary], weight: 4 },
    {
      label: "category",
      values: [profile.category, profile.sourceType],
      weight: 3,
    },
    { label: "task fit", values: profile.bestFor, weight: 8 },
    { label: "capability", values: profile.capabilities, weight: 7 },
    { label: "content", values: profile.contentObjects, weight: 4 },
    { label: "platform", values: profile.platforms, weight: 3 },
    { label: "framework", values: profile.frameworks, weight: 9 },
    { label: "integration", values: profile.integrationMethods, weight: 5 },
    {
      label: "access",
      values: [
        profile.accessModel.access,
        profile.accessModel.subscriptionRequired,
        ...profile.accessRoutes.map((route) => route.kind),
      ],
      weight: 2,
    },
  ];
}

function firstMatchingValue(
  fields: readonly MetadataField[],
  query: string,
): { field: MetadataField; value: string } | null {
  for (const field of fields) {
    const value = field.values.find((candidate) =>
      includesPhrase(candidate, query),
    );
    if (value) return { field, value };
  }

  return null;
}

function taskFieldMatches(
  fields: readonly MetadataField[],
  taskTerms: readonly string[],
): readonly { field: MetadataField; value: string; term: string }[] {
  const matches: { field: MetadataField; value: string; term: string }[] = [];

  for (const term of taskTerms) {
    for (const field of fields) {
      const value = field.values.find((candidate) =>
        normalizeText(candidate).includes(term),
      );
      if (value) {
        matches.push({ field, value, term });
        break;
      }
    }
  }

  return matches;
}

function addUnique(items: string[], value: string): void {
  if (!items.includes(value)) items.push(value);
}

function rankProfile(
  profile: SourceProfile,
  input: NormalizedTaskRetrievalInput,
): RankedCandidate | null {
  const fields = metadataFields(profile);
  const fitReasons: string[] = [];
  let score = 0;

  if (input.framework) {
    const match = firstMatchingValue(
      fields.filter((field) => field.label === "framework"),
      input.framework,
    );
    if (match) {
      score += 24;
      addUnique(fitReasons, `Recorded framework: ${match.value}.`);
    }
  }

  if (input.surface) {
    const match = firstMatchingValue(fields, input.surface);
    if (match) {
      score += 16 + match.field.weight;
      addUnique(
        fitReasons,
        `Matches requested surface in recorded ${match.field.label}: ${match.value}.`,
      );
    }
  }

  for (const need of input.needs) {
    const match = firstMatchingValue(fields, need);
    if (!match) continue;

    score += 14 + match.field.weight;
    addUnique(
      fitReasons,
      `Matches recorded ${match.field.label}: ${match.value}.`,
    );
  }

  for (const match of taskFieldMatches(fields, toTaskTerms(input.task))) {
    score += match.field.weight;
    if (fitReasons.length < 4) {
      addUnique(
        fitReasons,
        `Matches task term “${match.term}” in recorded ${match.field.label}: ${match.value}.`,
      );
    }
  }

  return score > 0 ? { profile, score, fitReasons } : null;
}

function isExcluded(
  profile: SourceProfile,
  exclusions: readonly string[],
): boolean {
  if (exclusions.length === 0) return false;

  const values = [
    ...metadataFields(profile).flatMap((field) => field.values),
    ...profile.limitations,
  ];

  return exclusions.some((exclusion) =>
    values.some((value) => includesPhrase(value, exclusion)),
  );
}

function toAlternatives(
  matches: readonly SimilarSourceMatch[],
  exclusions: readonly string[],
): readonly TaskRetrievalAlternative[] {
  return matches
    .filter(({ profile }) => !isExcluded(profile, exclusions))
    .slice(0, 2)
    .map(({ profile, differentiator }) => ({
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      url: profile.url,
      differentiator,
    }));
}

function toChoice(
  candidate: RankedCandidate,
  exclusions: readonly string[],
): TaskSourceChoice {
  const { profile } = candidate;
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    url: profile.url,
    summary: profile.summary,
    profileLevel: profile.profileLevel,
    fitReasons: candidate.fitReasons,
    caveats: [...profile.limitations],
    coverageNote: profile.coverage.reason,
    accessRoutes: profile.accessRoutes.map((route) => ({ ...route })),
    alternatives: toAlternatives(
      getSimilarSourceProfiles(profile, 2),
      exclusions,
    ),
  };
}

/**
 * Normalizes a task brief without changing the canonical source data. Arrays
 * are sorted and de-duplicated so equivalent inputs always rank the same way.
 */
export function normalizeTaskRetrievalInput(
  input: TaskRetrievalInput,
): NormalizedTaskRetrievalInput {
  const task = normalizeText(input.task);
  if (!task) {
    throw new TaskRetrievalInputError("task must contain non-whitespace text.");
  }

  return {
    task,
    surface: normalizeOptionalText(input.surface),
    framework: normalizeOptionalText(input.framework),
    needs: normalizeList(input.needs),
    exclusions: normalizeList(input.exclusions),
  };
}

/**
 * Returns a small, repository-backed source shortlist. Ranking considers only
 * canonical SourceProfile fields; it never calls providers or mutates state.
 */
export function retrieveTaskSources(
  input: TaskRetrievalInput,
): TaskRetrievalResult {
  const normalizedInput = normalizeTaskRetrievalInput(input);
  const ranked = getAllSourceProfiles()
    .filter((profile) => !isExcluded(profile, normalizedInput.exclusions))
    .flatMap((profile) => {
      const candidate = rankProfile(profile, normalizedInput);
      return candidate ? [candidate] : [];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareText(left.profile.name, right.profile.name) ||
        compareText(left.profile.id, right.profile.id),
    )
    .slice(0, MAX_TASK_RETRIEVAL_RESULTS)
    .map((candidate) => toChoice(candidate, normalizedInput.exclusions));

  return {
    input: normalizedInput,
    sources: ranked,
  };
}
