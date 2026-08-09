"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  getIntelligenceBadge,
  getIntelligenceProfile,
} from "@/lib/intelligence";

import styles from "./resource-card.module.css";

export type ResourceCardAccess =
  "free" | "freemium" | "paid" | "open-source" | "free-trial";

export type ResourceCardData = Readonly<{
  id: string;
  slug: string;
  name: string;
  url: string;
  domain: string;
  description: string;
  category: string;
  access: ResourceCardAccess;
  usefulFor: readonly string[];
  tags: readonly string[];
  status: "active" | "needs-review" | "unavailable";
  faviconUrl?: string;
  previewImageUrl?: string;
  previewSource?: "manual" | "open-graph" | "favicon" | "generated";
}>;

type ResourceCardMedia = Readonly<{
  previewUrl?: string;
  previewAlt?: string;
  faviconUrl?: string;
}>;

type ResourceCardProps = Readonly<{
  resource: ResourceCardData;
  categoryLabel: string;
  media?: ResourceCardMedia;
  /** Use the Tessli profile as the primary destination when supplied. */
  profileHref?: string;
  saved?: boolean;
  onSavedChange?: (resourceId: string, saved: boolean) => void;
}>;

type MediaCandidate = Readonly<{
  kind: "preview" | "favicon";
  src: string;
  alt: string;
}>;

const accessLabels: Record<ResourceCardAccess, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "open-source": "Open source",
  "free-trial": "Free trial",
};

function ExternalArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function InternalArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function SaveIcon({ saved }: { saved: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill={saved ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path d="M7 4.75h10a1.25 1.25 0 0 1 1.25 1.25v14l-6.25-4-6.25 4V6A1.25 1.25 0 0 1 7 4.75Z" />
    </svg>
  );
}

function safeImageSource(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function createMediaCandidates(
  resource: ResourceCardData,
  media: ResourceCardMedia | undefined,
): MediaCandidate[] {
  const previewUrl = safeImageSource(
    media?.previewUrl ?? resource.previewImageUrl,
  );
  const faviconUrl = safeImageSource(media?.faviconUrl ?? resource.faviconUrl);
  const candidates: MediaCandidate[] = [];

  if (previewUrl) {
    candidates.push({
      kind: "preview",
      src: previewUrl,
      alt: media?.previewAlt ?? `Preview of ${resource.name}`,
    });
  }

  if (faviconUrl) {
    candidates.push({
      kind: "favicon",
      src: faviconUrl,
      alt: "",
    });
  }

  return candidates;
}

function generatedMark(name: string) {
  const meaningful = Array.from(name.trim()).find((character) =>
    /[a-z0-9]/i.test(character),
  );
  return meaningful?.toUpperCase() ?? "T";
}

export function ResourceCard({
  resource,
  categoryLabel,
  media,
  profileHref,
  saved = false,
  onSavedChange,
}: ResourceCardProps) {
  const candidates = createMediaCandidates(resource, media);
  const [mediaIndex, setMediaIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const failedSourceRef = useRef<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const activeMedia = candidates[mediaIndex] ?? null;
  const visibleTags = Array.from(
    new Set([categoryLabel, ...resource.usefulFor, ...resource.tags]),
  ).slice(0, 3);
  const unavailable = resource.status === "unavailable";

  useEffect(() => {
    const image = imageRef.current;
    const source = activeMedia?.src;
    if (!image || !source) {
      return;
    }

    let listening = true;
    const advanceFallback = () => {
      if (!listening || failedSourceRef.current === source) {
        return;
      }

      failedSourceRef.current = source;
      setMediaIndex((current) => current + 1);
    };

    image.addEventListener("error", advanceFallback);
    if (image.complete && image.naturalWidth === 0) {
      queueMicrotask(advanceFallback);
    }

    return () => {
      listening = false;
      image.removeEventListener("error", advanceFallback);
    };
  }, [activeMedia?.src]);

  const profile =
    getIntelligenceProfile(resource.slug) ||
    getIntelligenceProfile(resource.id);
  const badgeText = profile ? getIntelligenceBadge(profile) : null;
  const internalProfileHref = profileHref?.trim() || null;
  const primaryHref = internalProfileHref ?? resource.url;
  const opensExternal = internalProfileHref === null;

  return (
    <article
      className={styles.card}
      data-media-state={activeMedia?.kind ?? "generated"}
      data-resource-access={resource.access}
      data-resource-card
      data-resource-category={resource.category}
      data-resource-name={resource.name}
      data-resource-primary-link={opensExternal ? "external" : "profile"}
      data-resource-slug={resource.slug}
      data-resource-status={resource.status}
    >
      <a
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={styles.cardLink}
        data-resource-profile-link={
          internalProfileHref ? resource.id : undefined
        }
        href={primaryHref}
        rel={opensExternal ? "noopener noreferrer" : undefined}
        target={opensExternal ? "_blank" : undefined}
      >
        <div className={styles.media}>
          {activeMedia ? (
            // Native img is intentional for arbitrary approved third-party domains.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={activeMedia.alt}
              className={`${styles.mediaImage} ${activeMedia.kind === "favicon" ? styles.faviconImage : ""}`}
              decoding="async"
              loading="lazy"
              ref={imageRef}
              referrerPolicy="no-referrer"
              src={activeMedia.src}
            />
          ) : (
            <span aria-hidden="true" className={styles.generatedMark}>
              {generatedMark(resource.name)}
            </span>
          )}
          <span className={styles.mediaLabel}>
            {activeMedia?.kind === "preview" ? "Preview" : resource.domain}
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.headingRow}>
            <div className={styles.headingCopy}>
              <p className={styles.domain}>{resource.domain}</p>
              <h3 id={titleId}>{resource.name}</h3>
            </div>
            {opensExternal ? <ExternalArrowIcon /> : <InternalArrowIcon />}
          </div>

          <p className={styles.description} id={descriptionId}>
            {resource.description.trim() || "Description not yet available."}
          </p>

          <div aria-label="Resource attributes" className={styles.tags}>
            {badgeText && (
              <span
                className={styles.intelligenceBadge}
                data-intelligence-badge="true"
              >
                {badgeText}
              </span>
            )}
            {visibleTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <footer className={styles.footer}>
            <span className={styles.access}>
              {accessLabels[resource.access]}
            </span>
            <span className={styles.status}>
              {unavailable ? "Unavailable" : "Open resource"}
            </span>
          </footer>
        </div>
      </a>

      {internalProfileHref ? (
        <div className={styles.profileAction}>
          <a
            aria-label={`Inspect ${resource.name} on Tessli`}
            className={styles.inspectAction}
            data-resource-inspect={resource.id}
            href={internalProfileHref}
          >
            Inspect <span aria-hidden="true">→</span>
          </a>
          {resource.status === "unavailable" ? (
            <span className={styles.unavailableAction}>
              Provider unavailable
            </span>
          ) : (
            <a
              data-resource-visit={resource.id}
              href={resource.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Visit <ExternalArrowIcon />
            </a>
          )}
        </div>
      ) : null}

      {onSavedChange ? (
        <button
          aria-label={
            saved
              ? `Remove ${resource.name} from saved resources`
              : `Save ${resource.name}`
          }
          aria-pressed={saved}
          className={styles.saveButton}
          data-resource-save={resource.id}
          onClick={() => onSavedChange(resource.id, !saved)}
          type="button"
        >
          <SaveIcon saved={saved} />
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
      ) : null}
    </article>
  );
}
