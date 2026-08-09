import Link from "next/link";
import { redirect } from "next/navigation";

import { BrowseResults } from "@/components/browse/browse-results";
import { BrowseFilters } from "@/components/browse/browse-filters";
import styles from "@/components/browse/browse.module.css";
import type {
  ResourceCardAccess,
  ResourceCardData,
} from "@/components/resource-card/resource-card";
import catalogue from "@/data/catalogue.json";
import {
  browseAccessValues,
  browseHref,
  browseSortValues,
  deriveBrowseResults,
  parseBrowseState,
  type BrowseSearchParams,
  type BrowseState,
} from "@/lib/browse";
import {
  getAllSourceProfiles,
  SOURCE_TYPES,
  type SourceProfile,
} from "@/lib/source-profiles";

export const metadata = {
  title: "Find design sources for your task",
  description:
    "Describe a design or frontend task, then refine Tessli's curated sources by category, type, and access.",
};

const accessLabels: Readonly<Record<string, string>> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "open-source": "Open source",
  "free-trial": "Free trial",
};

const sourceTypeLabels: Readonly<Record<string, string>> = Object.fromEntries(
  SOURCE_TYPES.map((type) => [
    type,
    type
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
  ]),
);

const categoryLabels = new Map(
  catalogue.categories.map((category) => [category.id, category.label]),
);
const categoryIds = new Set(categoryLabels.keys());
const sourceTypeIds = new Set<string>(SOURCE_TYPES);
const catalogueById = new Map(
  catalogue.resources.map((resource) => [resource.id, resource]),
);

function cardForProfile(profile: SourceProfile): ResourceCardData {
  const resource = catalogueById.get(profile.id);
  if (!resource) {
    throw new Error(
      `Missing catalogue record for source profile ${profile.id}.`,
    );
  }
  return {
    id: resource.id,
    slug: resource.slug,
    name: resource.name,
    url: resource.url,
    domain: resource.domain,
    description: resource.description,
    category: resource.category,
    access: resource.access as ResourceCardAccess,
    usefulFor: resource.usefulFor,
    tags: resource.tags,
    status: resource.status as ResourceCardData["status"],
    faviconUrl: resource.faviconUrl,
    previewImageUrl: resource.previewImageUrl,
    previewSource: resource.previewSource as ResourceCardData["previewSource"],
  };
}

function withState(state: BrowseState, patch: Partial<BrowseState>) {
  return browseHref({ ...state, ...patch });
}

function clearRefinementsHref(state: BrowseState) {
  return withState(state, {
    access: [],
    category: null,
    page: 1,
    sort: "curated",
    sourceType: null,
  });
}

function resultContext(state: BrowseState) {
  const refinements = [
    state.category ? categoryLabels.get(state.category) : null,
    state.sourceType ? sourceTypeLabels[state.sourceType] : null,
    ...state.access.map((access) => accessLabels[access]),
  ].filter((value): value is string => Boolean(value));

  const task = state.query ? ` for “${state.query}”` : "";
  const filters =
    refinements.length > 0 ? ` with ${refinements.join(", ")}` : "";

  return `${task}${filters}`;
}

type ResourcesPageProps = Readonly<{
  searchParams: Promise<BrowseSearchParams>;
}>;

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const rawSearchParams = await searchParams;
  const state = parseBrowseState(rawSearchParams, categoryIds, sourceTypeIds);
  const result = deriveBrowseResults(getAllSourceProfiles(), state);

  if (result.outOfRange) {
    redirect(withState(state, { page: result.page }));
  }

  const resources = result.resources.map((profile) => ({
    profile,
    categoryLabel: categoryLabels.get(profile.category) ?? profile.category,
    card: cardForProfile(profile),
  }));

  return (
    <main className={styles.page} id="main-content">
      <div className="tessli-container">
        <header className={styles.header}>
          <p>Find sources for a design task</p>
          <h1>What are you trying to design?</h1>
          <p className={styles.lede}>
            Describe the work in front of you, then narrow the source set by
            category, source type, or access.
          </p>
        </header>

        <BrowseFilters
          accessOptions={browseAccessValues.map((access) => ({
            value: access,
            label: accessLabels[access],
          }))}
          categories={catalogue.categories.map((category) => ({
            value: category.id,
            label: category.label,
          }))}
          sortOptions={browseSortValues.map((sort) => ({
            value: sort,
            label:
              sort === "curated"
                ? "Curated order"
                : sort === "name-asc"
                  ? "Name A–Z"
                  : "Name Z–A",
          }))}
          sourceTypeOptions={SOURCE_TYPES.map((sourceType) => ({
            value: sourceType,
            label: sourceTypeLabels[sourceType],
          }))}
          state={state}
        />

        <section aria-labelledby="browse-results-title">
          <div className={styles.summary}>
            <div>
              <h2 id="browse-results-title">
                {result.total} matching{" "}
                {result.total === 1 ? "source" : "sources"}
              </h2>
              <p className={styles.resultContext}>
                Showing sources that fit your task{resultContext(state)}. Page{" "}
                {result.page} of {result.pageCount}.
              </p>
            </div>
          </div>

          {resources.length === 0 ? (
            <div className={styles.empty}>
              <h2>No matching sources</h2>
              <p>
                Clear a refinement, or try a broader description of the task.
              </p>
              <div className={styles.emptyActions}>
                <Link href="/resources">Reset Browse</Link>
                {state.query ? (
                  <Link href={clearRefinementsHref(state)}>Keep this task</Link>
                ) : null}
              </div>
            </div>
          ) : (
            <BrowseResults resources={resources} />
          )}

          {result.pageCount > 1 ? (
            <nav aria-label="Browse pages" className={styles.pagination}>
              {result.page > 1 ? (
                <Link href={withState(state, { page: result.page - 1 })}>
                  Previous
                </Link>
              ) : (
                <span aria-disabled="true">Previous</span>
              )}
              <span aria-current="page">
                {result.page} / {result.pageCount}
              </span>
              {result.page < result.pageCount ? (
                <Link href={withState(state, { page: result.page + 1 })}>
                  Next
                </Link>
              ) : (
                <span aria-disabled="true">Next</span>
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
