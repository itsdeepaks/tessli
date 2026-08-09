import Link from "next/link";

import { CollectionCard } from "@/components/collection-card/collection-card";
import type { PublishedCollection } from "@/lib/collections";

import styles from "./home-task-entry.module.css";

type HomeTaskEntryProps = Readonly<{
  collections: readonly PublishedCollection[];
}>;

const taskStarters = [
  {
    description:
      "Find strong composition, hierarchy, and conversion references.",
    href: "/resources?q=landing",
    title: "Landing page references",
  },
  {
    description: "Compare systems, primitives, and implementation guidance.",
    href: "/resources?q=components",
    title: "A component library",
  },
  {
    description: "Study interaction references and buildable motion tools.",
    href: "/resources?q=motion",
    title: "Product motion",
  },
  {
    description: "Choose type tools, specimens, and font resources.",
    href: "/resources?q=type",
    title: "Typography",
  },
  {
    description: "Check contrast and build a more inclusive colour system.",
    href: "/resources?q=accessibility",
    title: "Colour accessibility",
  },
  {
    description: "Inspect tokens, foundations, and practical system examples.",
    href: "/resources?q=systems",
    title: "A design system",
  },
] as const;

const steps = [
  {
    detail: "Start with a task, then inspect a small set of relevant sources.",
    label: "Find sources",
  },
  {
    detail: "Save useful references and turn them into project decisions.",
    label: "Keep decisions",
  },
  {
    detail: "Share compact context with an agent before you build.",
    label: "Give an agent context",
  },
] as const;

export function HomeTaskEntry({ collections }: HomeTaskEntryProps) {
  return (
    <div className={styles.page} data-home-task-entry>
      <section
        aria-labelledby="home-task-starters-title"
        className={styles.taskSection}
      >
        <div className="tessli-container">
          <header className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Start with the work</p>
            <h2 id="home-task-starters-title">
              What are you trying to design?
            </h2>
            <p>Pick a starting point, then refine the source set in Browse.</p>
          </header>

          <ul className={styles.taskGrid}>
            {taskStarters.map((task) => (
              <li key={task.href}>
                <Link className={styles.taskLink} href={task.href}>
                  <span>{task.title}</span>
                  <small>{task.description}</small>
                  <b aria-hidden="true">→</b>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="home-workflow-title"
        className={styles.workflowSection}
      >
        <div className={`tessli-container ${styles.workflowLayout}`}>
          <header className={styles.workflowHeading}>
            <p className={styles.eyebrow}>A useful research loop</p>
            <h2 id="home-workflow-title">
              From a good reference to a better next decision.
            </h2>
          </header>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.label}>
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{step.label}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="home-collections-title"
        className={styles.collectionsSection}
      >
        <div className="tessli-container">
          <header className={styles.collectionsHeading}>
            <div>
              <p className={styles.eyebrow}>Guided research paths</p>
              <h2 id="home-collections-title">Follow a practical sequence.</h2>
            </div>
            <Link href="/collections">View all collections →</Link>
          </header>

          <ul className={styles.collectionGrid}>
            {collections.map((collection) => (
              <li key={collection.id}>
                <CollectionCard collection={collection} variant="compact" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="home-ai-title" className={styles.agentSection}>
        <div className={`tessli-container ${styles.agentLayout}`}>
          <div>
            <p className={styles.eyebrow}>For coding agents</p>
            <h2 id="home-ai-title">Give an agent a better starting point.</h2>
          </div>
          <div className={styles.agentCopy}>
            <p>
              Tessli exposes the same source guidance as readable pages, JSON,
              Markdown, and local MCP tools. Keep your selected references and
              decisions in a Board, then hand over only the context that
              matters.
            </p>
            <Link href="/for-ai">See how Tessli works with AI →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
