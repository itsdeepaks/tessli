"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ResourceCard,
  type ResourceCardData,
} from "@/components/resource-card/resource-card";
import {
  readSavedResourceIds,
  savedResourceChangedEvent,
  savedResourceStoreKey,
  writeSavedResourceIds,
} from "@/components/saved-resources/save-store";

import styles from "./collection-resource-list.module.css";

type CollectionResource = Readonly<{
  resource: ResourceCardData;
  categoryLabel: string;
  role: string;
}>;

type CollectionResourceListProps = Readonly<{
  resources: readonly CollectionResource[];
  className: string;
  inspectPrompt: string;
  decisionPrompt: string;
}>;

export function CollectionResourceList({
  resources,
  className,
  inspectPrompt,
  decisionPrompt,
}: CollectionResourceListProps) {
  const cards = useMemo(
    () => resources.map((item) => item.resource),
    [resources],
  );
  const [savedIds, setSavedIds] = useState<readonly string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const synchronize = () => setSavedIds(readSavedResourceIds(cards));
    synchronize();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === savedResourceStoreKey) {
        synchronize();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(savedResourceChangedEvent, synchronize);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(savedResourceChangedEvent, synchronize);
    };
  }, [cards]);

  const handleSavedChange = useCallback(
    (resourceId: string, saved: boolean) => {
      const current = readSavedResourceIds(cards);
      const next = saved
        ? Array.from(new Set([...current, resourceId]))
        : current.filter((id) => id !== resourceId);

      if (!writeSavedResourceIds(next)) {
        setAnnouncement(
          "This browser did not allow Tessli to update saved resources.",
        );
        return;
      }

      setSavedIds(next);
      const resource = cards.find((item) => item.id === resourceId);
      setAnnouncement(
        `${resource?.name ?? "Resource"} ${saved ? "saved" : "removed from saved resources"}.`,
      );
    },
    [cards],
  );

  return (
    <>
      <ol className={className} data-collection-resource-grid>
        {resources.map(({ resource, categoryLabel, role }) => (
          <li data-playbook-resource-role key={resource.id}>
            <dl className={styles.role}>
              <div>
                <dt>Role — Why included</dt>
                <dd>{role}</dd>
              </div>
              <div>
                <dt>Inspect</dt>
                <dd>{inspectPrompt}</dd>
              </div>
              <div>
                <dt>Decision prompt</dt>
                <dd>{decisionPrompt}</dd>
              </div>
            </dl>
            <ResourceCard
              categoryLabel={categoryLabel}
              onSavedChange={handleSavedChange}
              profileHref={`/resources/${resource.slug}`}
              resource={resource}
              saved={savedIds.includes(resource.id)}
            />
          </li>
        ))}
      </ol>
      <p aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
    </>
  );
}
