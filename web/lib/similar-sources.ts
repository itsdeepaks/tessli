import type { SourceProfile } from "./source-profiles.ts";
import { getAllSourceProfiles } from "./source-profiles.ts";

export interface SimilarSourceMatch {
  profile: SourceProfile;
  differentiator: string;
}

function label(value: string) {
  return value
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function firstRecordedDifference(
  source: SourceProfile,
  candidate: SourceProfile,
): { differentiator: string; priority: number } | null {
  const candidateWorkflow = candidate.bestFor.find(
    (item) => !source.bestFor.includes(item),
  );
  if (candidateWorkflow) {
    return {
      differentiator: `Recorded task fit: ${label(candidateWorkflow)}.`,
      priority: 1,
    };
  }

  const candidateCapability = candidate.capabilities.find(
    (item) => !source.capabilities.includes(item),
  );
  if (candidateCapability) {
    return {
      differentiator: `Recorded capability: ${label(candidateCapability)}.`,
      priority: 2,
    };
  }

  const candidateContent = candidate.contentObjects.find(
    (item) => !source.contentObjects.includes(item),
  );
  if (candidateContent) {
    return {
      differentiator: `Recorded material: ${label(candidateContent)}.`,
      priority: 3,
    };
  }

  const candidateFramework = candidate.frameworks.find(
    (item) => !source.frameworks.includes(item),
  );
  if (candidateFramework) {
    return {
      differentiator: `Recorded framework: ${label(candidateFramework)}.`,
      priority: 4,
    };
  }

  const candidateAccessRoute = candidate.accessRoutes.find(
    (route) =>
      !source.accessRoutes.some(
        (sourceRoute) => sourceRoute.kind === route.kind,
      ),
  );
  if (candidateAccessRoute) {
    return {
      differentiator: `Recorded access route: ${label(candidateAccessRoute.kind)}.`,
      priority: 5,
    };
  }

  return null;
}

export function getSimilarSourceProfiles(
  source: SourceProfile,
  limit = 4,
): readonly SimilarSourceMatch[] {
  if (limit <= 0) return [];

  return getAllSourceProfiles()
    .filter(
      (candidate) =>
        candidate.id !== source.id &&
        candidate.category === source.category &&
        candidate.intelligence,
    )
    .flatMap((candidate) => {
      const difference = firstRecordedDifference(source, candidate);
      return difference ? [{ candidate, ...difference }] : [];
    })
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.candidate.name.localeCompare(right.candidate.name),
    )
    .slice(0, limit)
    .map(({ candidate, differentiator }) => ({
      profile: candidate,
      differentiator,
    }));
}
