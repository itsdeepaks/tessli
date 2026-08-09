import { CollectionCard } from "@/components/collection-card/collection-card";
import { getPublishedCollections } from "@/lib/collections";

import styles from "./collections.module.css";

export const metadata = {
  title: "Collections",
  description:
    "Guided Tessli research paths for practical design and frontend decisions.",
};

export default function CollectionsPage() {
  const collections = getPublishedCollections();

  return (
    <main className={styles.page} id="main-content">
      <div className="tessli-container">
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Collections</p>
          <h1>Which guided research path matches my goal?</h1>
          <p className={styles.lede}>
            Choose a focused path, then work through its stages to make the next
            design or frontend decision with useful context.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="collections-title">
          <div className={styles.sectionHeading}>
            <h2 id="collections-title">Guided research paths</h2>
            <p>
              Each path makes its goal, audience, and intended decision clear.
            </p>
          </div>

          {collections.length > 0 ? (
            <ul className={styles.grid} data-collections-grid>
              {collections.map((collection) => (
                <li key={collection.id}>
                  <CollectionCard collection={collection} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty} role="status">
              No guided research paths are published yet. Browse Tessli sources
              to begin your research.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
