"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { browseHref, defaultBrowseState, type BrowseState } from "@/lib/browse";

import styles from "./browse.module.css";

type BrowseFilterOption = Readonly<{
  value: string;
  label: string;
}>;

type BrowseFiltersProps = Readonly<{
  state: BrowseState;
  categories: readonly BrowseFilterOption[];
  accessOptions: readonly BrowseFilterOption[];
  sourceTypeOptions: readonly BrowseFilterOption[];
  sortOptions: readonly BrowseFilterOption[];
}>;

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function activeFilterCount(state: BrowseState) {
  return (
    Number(Boolean(state.category)) +
    Number(state.access.length > 0) +
    Number(Boolean(state.sourceType)) +
    Number(state.sort !== "curated")
  );
}

function FilterSelect({
  allLabel,
  label,
  name,
  options,
  value,
}: Readonly<{
  allLabel?: string;
  label: string;
  name: string;
  options: readonly BrowseFilterOption[];
  value: string;
}>) {
  return (
    <label>
      {label}
      <select defaultValue={value} name={name}>
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BrowseFilters({
  state,
  categories,
  accessOptions,
  sourceTypeOptions,
  sortOptions,
}: BrowseFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(state);
  const clearHref = browseHref({
    ...defaultBrowseState,
    query: state.query,
  });

  const restoreFocus = useCallback(() => {
    window.setTimeout(() => {
      const trigger =
        triggerRef.current ??
        document.querySelector<HTMLButtonElement>(
          "[data-browse-filter-trigger]",
        );
      if (trigger?.isConnected) trigger.focus();
    }, 0);
  }, []);

  const closeFilters = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const sheet = sheetRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const focusable = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    const focusFrame = window.requestAnimationFrame(() =>
      focusable()[0]?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilters();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);

      if (!first || !last) {
        event.preventDefault();
        return;
      }

      if (!sheet?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const desktopQuery = window.matchMedia("(min-width: 701px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeFilters();
    };

    desktopQuery.addEventListener("change", closeAtDesktop);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      desktopQuery.removeEventListener("change", closeAtDesktop);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      restoreFocus();
    };
  }, [closeFilters, isOpen, restoreFocus]);

  return (
    <form
      action="/resources"
      className={styles.controls}
      method="get"
      onSubmit={closeFilters}
    >
      <label className={styles.searchField}>
        Search
        <input
          id="browse-search"
          defaultValue={state.query}
          maxLength={160}
          name="q"
          placeholder="e.g. accessible colour system or SaaS dashboard"
          type="search"
        />
      </label>

      <button
        aria-controls="browse-filter-sheet"
        aria-expanded={isOpen}
        className={styles.mobileFilterTrigger}
        data-browse-filter-trigger
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Filter{count > 0 ? ` (${count} active)` : ""}
      </button>

      <div
        className={`${styles.filterFields} ${isOpen ? styles.filterFieldsOpen : ""}`}
        data-browse-filter-layer={isOpen ? "open" : "closed"}
      >
        <button
          aria-label="Dismiss filters"
          className={styles.filterBackdrop}
          onClick={closeFilters}
          tabIndex={-1}
          type="button"
        />
        <div
          aria-labelledby={isOpen ? "browse-filter-title" : undefined}
          aria-modal={isOpen ? "true" : undefined}
          className={styles.filterSheet}
          data-browse-filter-sheet
          id="browse-filter-sheet"
          ref={sheetRef}
          role={isOpen ? "dialog" : undefined}
        >
          <div className={styles.filterSheetHeader}>
            <div>
              <p className={styles.filterSheetKicker}>Refine this source set</p>
              <h2 id="browse-filter-title">Refine results</h2>
            </div>
            <button
              aria-label="Close filters"
              className={styles.filterClose}
              onClick={closeFilters}
              type="button"
            >
              ×
            </button>
          </div>

          <div className={styles.filterGrid}>
            <FilterSelect
              allLabel="All categories"
              label="Category"
              name="category"
              options={categories}
              value={state.category ?? ""}
            />
            <FilterSelect
              allLabel="All access models"
              label="Access"
              name="access"
              options={accessOptions}
              value={state.access[0] ?? ""}
            />
            <FilterSelect
              allLabel="All source types"
              label="Source type"
              name="sourceType"
              options={sourceTypeOptions}
              value={state.sourceType ?? ""}
            />
            <FilterSelect
              label="Sort"
              name="sort"
              options={sortOptions}
              value={state.sort}
            />
          </div>

          <div className={styles.filterActions}>
            <button type="submit">Apply filters</button>
            {count > 0 ? (
              <Link
                className={styles.clearFilters}
                href={clearHref}
                onClick={closeFilters}
              >
                Clear refinements
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
