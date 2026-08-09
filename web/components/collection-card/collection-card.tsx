import Link from "next/link";

import {
  type CollectionCoverStyle,
  type PublishedCollection,
} from "@/lib/collections";

import styles from "./collection-card.module.css";

export type CollectionCardVariant = "featured" | "compact";

type CollectionCardProps = Readonly<{
  collection: PublishedCollection;
  variant?: CollectionCardVariant;
}>;

type CollectionCoverProps = Readonly<{
  style: CollectionCoverStyle;
  title: string;
}>;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function initials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function CollectionCover({ style, title }: CollectionCoverProps) {
  return (
    <div
      aria-hidden="true"
      className={styles.cover}
      data-collection-cover-style={style}
    >
      <span className={styles.coverIndex}>{initials(title)}</span>
      <span className={styles.coverLine} />
      <span className={styles.coverShape} />
      <span className={styles.coverDot} />
    </div>
  );
}

export function CollectionCard({ collection, variant }: CollectionCardProps) {
  const expectedDecision =
    collection.stages[collection.stages.length - 1]?.decision;

  return (
    <article
      className={styles.card}
      data-collection-card
      data-collection-slug={collection.slug}
      data-collection-stage-count={collection.stages.length}
      data-collection-variant={variant}
    >
      <Link className={styles.link} href={`/collections/${collection.slug}`}>
        <CollectionCover
          style={collection.coverStyle}
          title={collection.title}
        />
        <div className={styles.body}>
          <div className={styles.headingRow}>
            <h3>{collection.title}</h3>
            <ArrowIcon />
          </div>

          <dl className={styles.facts}>
            <div>
              <dt>Goal</dt>
              <dd>{collection.description}</dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>{collection.outcome}</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>{collection.audience}</dd>
            </div>
            <div>
              <dt>Stages</dt>
              <dd>{collection.stages.length}</dd>
            </div>
            <div className={styles.decision}>
              <dt>Expected decision</dt>
              <dd>{expectedDecision}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </article>
  );
}
