import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollectionCover } from "@/components/collection-card/collection-card";
import { CollectionResourceList } from "@/components/collection-resources/collection-resource-list";
import {
  getPublishedCollection,
  getPublishedCollections,
} from "@/lib/collections";

import styles from "./collection-detail.module.css";

export const dynamicParams = false;

type CollectionDetailPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export function generateStaticParams() {
  return getPublishedCollections().map((collection) => ({
    slug: collection.slug,
  }));
}

export async function generateMetadata({
  params,
}: CollectionDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const playbook = getPublishedCollection(slug);

  if (!playbook) {
    return { title: "Collection not found" };
  }

  return {
    title: playbook.title,
    description: playbook.outcome,
  };
}

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { slug } = await params;
  const playbook = getPublishedCollection(slug);

  if (!playbook) {
    notFound();
  }

  return (
    <main
      className={styles.page}
      data-collection-detail={playbook.slug}
      data-playbook-stage-count={playbook.stages.length}
      id="main-content"
    >
      <div className="tessli-container">
        <nav aria-label="Collection breadcrumb" className={styles.breadcrumb}>
          <Link href="/collections">Collections</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{playbook.title}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.coverFrame}>
            <CollectionCover
              style={playbook.coverStyle}
              title={playbook.title}
            />
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Guided research path</p>
            <h1>{playbook.title}</h1>
            <div className={styles.intentGrid}>
              <section aria-labelledby="goal-title">
                <p className={styles.intentLabel} id="goal-title">
                  Goal
                </p>
                <p>{playbook.description}</p>
              </section>
              <section aria-labelledby="audience-title">
                <p className={styles.intentLabel} id="audience-title">
                  Audience
                </p>
                <p>{playbook.audience}</p>
              </section>
              <section aria-labelledby="decision-title">
                <p className={styles.intentLabel} id="decision-title">
                  Expected decision
                </p>
                <p>{playbook.outcome}</p>
              </section>
            </div>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/boards">
                Continue in Boards
              </Link>
            </div>
            <p className={styles.boardNote}>
              Save sources here, then use Boards to record the choices you want
              to carry into your project.
            </p>
          </div>
        </header>

        <section className={styles.resources} aria-labelledby="stages-title">
          <header className={styles.resourcesHeading}>
            <div>
              <p className={styles.eyebrow}>Ordered research sequence</p>
              <h2 id="stages-title">Inspect one stage at a time</h2>
            </div>
            <p>
              Start with the first stage, inspect each source against its
              prompt, and save the references that help you make the decision.
            </p>
          </header>

          <div className={styles.stageList}>
            {playbook.stages.map((stage, index) => (
              <article
                className={styles.stage}
                data-playbook-stage={stage.id}
                key={stage.id}
              >
                <header className={styles.stageHeader}>
                  <div>
                    <p className={styles.stageNumber}>Stage {index + 1}</p>
                    <h3>{stage.title}</h3>
                  </div>
                  <dl className={styles.stageGuidance}>
                    <div>
                      <dt>Inspect</dt>
                      <dd>{stage.inspect}</dd>
                    </div>
                    <div>
                      <dt>Decision supported</dt>
                      <dd>{stage.decision}</dd>
                    </div>
                  </dl>
                </header>

                <CollectionResourceList
                  className={styles.grid}
                  decisionPrompt={stage.decision}
                  inspectPrompt={stage.inspect}
                  resources={stage.resources}
                />
              </article>
            ))}
          </div>
        </section>

        <aside aria-label="Machine access" className={styles.machineAccess}>
          <p>Machine access</p>
          <div>
            <a href={`/collections/${playbook.slug}/collection.json`}>JSON</a>
            <a href={`/collections/${playbook.slug}/collection.md`}>Markdown</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
