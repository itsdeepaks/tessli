"use client";

import { useEffect, useState } from "react";

import { BoardIntake } from "@/components/board-intake/board-intake";
import {
  readSavedResourceIds,
  writeSavedResourceIds,
} from "@/components/saved-resources/save-store";
import type { ResourceCardData } from "@/components/resource-card/resource-card";

import styles from "./source-actions.module.css";

type SourceActionsProps = Readonly<{
  resource: ResourceCardData;
}>;

export function SourceActions({ resource }: SourceActionsProps) {
  const [saved, setSaved] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const synchronize = () =>
      setSaved(readSavedResourceIds([resource]).includes(resource.id));
    synchronize();
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [resource]);

  function toggleSaved() {
    const current = readSavedResourceIds([resource]);
    const nextSaved = !current.includes(resource.id);
    const next = nextSaved
      ? Array.from(new Set([...current, resource.id]))
      : current.filter((id) => id !== resource.id);
    writeSavedResourceIds(next);
    setSaved(nextSaved);
    setAnnouncement(
      `${resource.name} ${nextSaved ? "saved" : "removed from saved resources"}.`,
    );
  }

  return (
    <div className={styles.wrapper}>
      <p aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
      <button aria-pressed={saved} onClick={toggleSaved} type="button">
        {saved ? "Saved" : "Save source"}
      </button>
      <BoardIntake resource={resource} />
      {resource.status === "unavailable" ? (
        <span className={styles.unavailable}>
          Provider currently unavailable
        </span>
      ) : (
        <a href={resource.url} rel="noopener noreferrer" target="_blank">
          Visit source ↗
        </a>
      )}
    </div>
  );
}
