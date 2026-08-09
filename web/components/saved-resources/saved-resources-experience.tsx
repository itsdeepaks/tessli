"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ResourceCard,
  type ResourceCardData,
} from "@/components/resource-card/resource-card";
import {
  ToastNotification,
  type ToastMessage,
} from "@/components/toast-notification/toast-notification";
import { BoardIntake } from "@/components/board-intake/board-intake";
import {
  readSavedResourceIds,
  savedResourceStoreKey,
  writeSavedResourceIds,
} from "./save-store";
import styles from "./saved-resources.module.css";

type SavedResourcesExperienceProps = Readonly<{
  resources: readonly ResourceCardData[];
  categoryLabels: Readonly<Record<string, string>>;
}>;

type SortOption = "recent" | "name-asc" | "name-desc";

function resourceCountLabel(count: number) {
  return `${count} ${count === 1 ? "resource" : "resources"}`;
}

function normalizedSearchText(resource: ResourceCardData) {
  return [
    resource.name,
    resource.domain,
    resource.description,
    resource.usefulFor,
    resource.tags.join(" "),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export function SavedResourcesExperience({
  resources,
  categoryLabels,
}: SavedResourcesExperienceProps) {
  const [savedResourceIds, setSavedResourceIds] = useState<readonly string[]>(
    [],
  );
  const [clearedResourceIds, setClearedResourceIds] = useState<
    readonly string[] | null
  >(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [access, setAccess] = useState("all");
  const [sort, setSort] = useState<SortOption>("recent");
  const [announcement, setAnnouncement] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const synchronizeSavedResources = () => {
      setSavedResourceIds(readSavedResourceIds(resources));
    };

    synchronizeSavedResources();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === savedResourceStoreKey) {
        synchronizeSavedResources();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [resources]);

  const resourcesById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );

  const savedResources = useMemo(
    () =>
      savedResourceIds
        .slice()
        .reverse()
        .flatMap((resourceId) => {
          const resource = resourcesById.get(resourceId);
          return resource ? [resource] : [];
        }),
    [resourcesById, savedResourceIds],
  );

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(savedResources.map((resource) => resource.category)),
      ).sort((left, right) =>
        (categoryLabels[left] ?? left).localeCompare(
          categoryLabels[right] ?? right,
        ),
      ),
    [categoryLabels, savedResources],
  );

  const availableAccessModels = useMemo(
    () =>
      Array.from(
        new Set(savedResources.map((resource) => resource.access)),
      ).sort(),
    [savedResources],
  );

  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = savedResources.filter((resource) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalizedSearchText(resource).includes(normalizedQuery);
      const matchesCategory =
        category === "all" || resource.category === category;
      const matchesAccess = access === "all" || resource.access === access;
      return matchesQuery && matchesCategory && matchesAccess;
    });

    if (sort === "name-asc") {
      return filtered.sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    }

    if (sort === "name-desc") {
      return filtered.sort((left, right) =>
        right.name.localeCompare(left.name),
      );
    }

    return filtered;
  }, [access, category, query, savedResources, sort]);

  const closeConfirmation = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const handleDialogClose = useCallback(() => {
    window.requestAnimationFrame(() => clearTriggerRef.current?.focus());
  }, []);

  const restoreResource = useCallback(
    (resourceId: string) => {
      setSavedResourceIds((currentIds) => {
        const restoredIds = currentIds.includes(resourceId)
          ? currentIds
          : [...currentIds, resourceId];
        writeSavedResourceIds(restoredIds);
        return restoredIds;
      });
      const resource = resourcesById.get(resourceId);
      setAnnouncement(`${resource?.name ?? "Resource"} restored.`);
    },
    [resourcesById],
  );

  const restoreClearedResources = useCallback(
    (resourceIds: readonly string[]) => {
      setSavedResourceIds((currentIds) => {
        const restoredIds = Array.from(
          new Set([...resourceIds, ...currentIds]),
        );
        writeSavedResourceIds(restoredIds);
        return restoredIds;
      });
      setClearedResourceIds(null);
      setAnnouncement(`${resourceCountLabel(resourceIds.length)} restored.`);
    },
    [],
  );

  const handleSavedChange = useCallback(
    (resourceId: string, saved: boolean) => {
      const next = saved
        ? Array.from(new Set([...savedResourceIds, resourceId]))
        : savedResourceIds.filter((id) => id !== resourceId);
      writeSavedResourceIds(next);
      setSavedResourceIds(next);
      setClearedResourceIds(null);

      const resource = resourcesById.get(resourceId);
      const name = resource?.name ?? "Resource";
      const message = `${name} ${saved ? "saved to browser" : "removed"}.`;
      setAnnouncement(message);
      setToasts((current) => [
        ...current,
        {
          id: `toast-${Date.now()}-${Math.random()}`,
          message,
          ...(saved
            ? {}
            : {
                onUndo: () => restoreResource(resourceId),
                undoLabel: "Undo",
              }),
        },
      ]);
    },
    [resourcesById, restoreResource, savedResourceIds],
  );

  const openConfirmation = () => {
    dialogRef.current?.showModal();
  };

  const clearSavedResources = () => {
    const previous = savedResourceIds;
    writeSavedResourceIds([]);
    setSavedResourceIds([]);
    setClearedResourceIds(previous);
    const message = "Saved resources cleared.";
    setAnnouncement(`${message} You can undo this change.`);
    setToasts((current) => [
      ...current,
      {
        id: `toast-${Date.now()}`,
        message,
        onUndo: () => restoreClearedResources(previous),
        undoLabel: "Undo",
      },
    ]);
    closeConfirmation();
  };

  const undoClear = () => {
    if (!clearedResourceIds) return;
    restoreClearedResources(clearedResourceIds);
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setAccess("all");
    setSort("recent");
    setAnnouncement("Saved workspace filters cleared.");
  };

  const hasSavedResources = savedResources.length > 0;
  const hasActiveFilters =
    query.length > 0 ||
    category !== "all" ||
    access !== "all" ||
    sort !== "recent";

  return (
    <section
      aria-labelledby="saved-resources-title"
      className={styles.section}
      data-saved-resources-page="true"
    >
      <div className="tessli-container">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Private browser workspace</p>
            <h1 id="saved-resources-title">Saved resources</h1>
            <p className={styles.summary}>
              Search and refine the references kept in this browser. Boards stay
              in this browser and are not uploaded or synced.
            </p>
          </div>

          {hasSavedResources ? (
            <div className={styles.actions}>
              <p>{resourceCountLabel(savedResources.length)}</p>
              <button
                className={styles.clearButton}
                data-clear-saved
                onClick={openConfirmation}
                ref={clearTriggerRef}
                type="button"
              >
                Clear saved
              </button>
            </div>
          ) : null}
        </header>

        {clearedResourceIds ? (
          <div className={styles.undoNotice} role="status">
            <p>Saved resources cleared.</p>
            <button data-undo-clear-saved onClick={undoClear} type="button">
              Undo
            </button>
          </div>
        ) : null}

        {hasSavedResources ? (
          <>
            <div
              className={styles.workspace}
              aria-label="Saved resource controls"
            >
              <label className={styles.searchField}>
                <span>Search saved resources</span>
                <input
                  data-saved-search
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, domain, use case, or tag"
                  type="search"
                  value={query}
                />
              </label>

              <label>
                <span>Category</span>
                <select
                  data-saved-category
                  onChange={(event) => setCategory(event.target.value)}
                  value={category}
                >
                  <option value="all">All categories</option>
                  {availableCategories.map((categoryId) => (
                    <option key={categoryId} value={categoryId}>
                      {categoryLabels[categoryId] ?? categoryId}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Access</span>
                <select
                  data-saved-access
                  onChange={(event) => setAccess(event.target.value)}
                  value={access}
                >
                  <option value="all">All access models</option>
                  {availableAccessModels.map((accessModel) => (
                    <option key={accessModel} value={accessModel}>
                      {accessModel}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Sort</span>
                <select
                  data-saved-sort
                  onChange={(event) =>
                    setSort(event.target.value as SortOption)
                  }
                  value={sort}
                >
                  <option value="recent">Most recently saved</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                </select>
              </label>

              {hasActiveFilters ? (
                <button
                  className={styles.resetButton}
                  data-saved-reset
                  onClick={resetFilters}
                  type="button"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className={styles.resultsHeading}>
              <div>
                <p className={styles.eyebrow}>Saved shortlist</p>
                <h2>
                  {filteredResources.length === savedResources.length
                    ? "Kept close for your next reference."
                    : `${resourceCountLabel(filteredResources.length)} match your filters.`}
                </h2>
              </div>
              <p>
                {sort === "recent"
                  ? "Most recently saved first."
                  : sort === "name-asc"
                    ? "Sorted A–Z."
                    : "Sorted Z–A."}
              </p>
            </div>

            {filteredResources.length > 0 ? (
              <ul className={styles.grid} data-saved-resource-grid>
                {filteredResources.map((resource) => (
                  <li key={resource.id}>
                    <ResourceCard
                      categoryLabel={
                        categoryLabels[resource.category] ?? resource.category
                      }
                      onSavedChange={handleSavedChange}
                      profileHref={`/resources/${resource.slug}`}
                      resource={resource}
                      saved
                    />
                    <div className={styles.boardAction}>
                      <BoardIntake resource={resource} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div
                className={styles.filteredEmpty}
                data-saved-filtered-empty
                role="status"
              >
                <p className={styles.eyebrow}>No matching saves</p>
                <h2>Try a broader search or remove a filter.</h2>
                <button
                  className={styles.resetButton}
                  onClick={resetFilters}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState} data-saved-resources-empty>
            <p className={styles.eyebrow}>Nothing saved yet</p>
            <h2>Keep the useful references nearby.</h2>
            <p>
              Use the save control on Browse, Source Detail, or a collection.
              Your choices remain private to this browser.
            </p>
            <Link className={styles.exploreLink} href="/resources">
              Browse resources
            </Link>
          </div>
        )}

        <p aria-live="polite" className={styles.visuallyHidden}>
          {announcement}
        </p>
      </div>

      <dialog
        aria-labelledby="clear-saved-title"
        className={styles.dialog}
        onCancel={(event) => {
          event.preventDefault();
          closeConfirmation();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeConfirmation();
        }}
        onClose={handleDialogClose}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeConfirmation();
          }
        }}
        ref={dialogRef}
      >
        <div className={styles.dialogContent}>
          <p className={styles.eyebrow}>Clear private saves</p>
          <h2 id="clear-saved-title">Clear every saved resource?</h2>
          <p>
            This removes the saved list from this browser. You can undo the
            change while this page remains open.
          </p>
          <div className={styles.dialogActions}>
            <button onClick={closeConfirmation} type="button">
              Keep saves
            </button>
            <button
              className={styles.destructiveButton}
              data-confirm-clear-saved
              onClick={clearSavedResources}
              type="button"
            >
              Clear saved
            </button>
          </div>
        </div>
      </dialog>
      <ToastNotification toasts={toasts} onDismiss={handleDismissToast} />
    </section>
  );
}
