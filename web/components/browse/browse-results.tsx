"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ResourceCard,
  type ResourceCardData,
} from "@/components/resource-card/resource-card";
import {
  readSavedResourceIds,
  writeSavedResourceIds,
} from "@/components/saved-resources/save-store";
import type { SourceProfile } from "@/lib/source-profiles";

import styles from "./browse.module.css";

type BrowseResult = Readonly<{
  profile: SourceProfile;
  categoryLabel: string;
  card: ResourceCardData;
}>;

type BrowseResultsProps = Readonly<{
  resources: readonly BrowseResult[];
}>;

export function BrowseResults({ resources }: BrowseResultsProps) {
  const cards = useMemo(() => resources.map((item) => item.card), [resources]);
  const [savedIds, setSavedIds] = useState<readonly string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const synchronize = () => setSavedIds(readSavedResourceIds(cards));
    synchronize();
    const handleStorage = () => synchronize();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [cards]);

  const handleSavedChange = useCallback(
    (resourceId: string, saved: boolean) => {
      const next = saved
        ? Array.from(new Set([...savedIds, resourceId]))
        : savedIds.filter((id) => id !== resourceId);
      writeSavedResourceIds(next);
      setSavedIds(next);
      const resource = cards.find((item) => item.id === resourceId);
      setAnnouncement(
        `${resource?.name ?? "Resource"} ${saved ? "saved" : "removed from saved resources"}.`,
      );
    },
    [cards, savedIds],
  );

  return (
    <>
      <p aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
      <div className={styles.cardGrid} data-browse-view="cards">
        {resources.map(({ profile, categoryLabel, card }) => (
          <ResourceCard
            categoryLabel={categoryLabel}
            key={profile.id}
            onSavedChange={handleSavedChange}
            profileHref={`/resources/${profile.slug}`}
            resource={{ ...card, description: profile.summary }}
            saved={savedIds.includes(card.id)}
          />
        ))}
      </div>
    </>
  );
}
