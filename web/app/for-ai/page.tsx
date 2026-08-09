import Link from "next/link";

import {
  TESSLI_MCP_NODE_REQUIREMENT,
  TESSLI_MCP_SERVER_NAME,
  TESSLI_MCP_SERVER_VERSION,
  TESSLI_MCP_TOOL_CATALOGUE,
} from "@/lib/mcp-tool-catalogue";
import { getPublishedCollections } from "@/lib/collections";
import {
  SOURCE_FRESHNESS_WINDOWS,
  getSourceContractSummary,
  getSourceProfile,
} from "@/lib/source-profiles";

import styles from "./for-ai.module.css";

export const metadata = {
  title: "For AI",
  description:
    "Use Tessli through semantic pages, JSON and Markdown representations, browser-local research packs, or five read-only local MCP tools.",
};

const repositoryUrl = "https://github.com/itsdeepaks/tessli";
const setupCommands = `git clone https://github.com/itsdeepaks/tessli.git
cd tessli/web
npm ci
npm run mcp`;
const clientConfiguration = `{
  "mcpServers": {
    "tessli": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/tessli/web"
    }
  }
}`;

function requireSourceProfile(identifier: string) {
  const profile = getSourceProfile(identifier);
  if (!profile) {
    throw new Error(`Missing For AI source-profile example: ${identifier}.`);
  }
  return profile;
}

export default function ForAiPage() {
  const coverage = getSourceContractSummary();
  const profiledExample = requireSourceProfile("landingfolio");
  const listedExample = requireSourceProfile("designindex");
  const playbook = getPublishedCollections()[0];

  if (!playbook) {
    throw new Error("A published Playbook is required for the For AI page.");
  }

  const freshnessAgingStart = SOURCE_FRESHNESS_WINDOWS.currentMaxDays + 1;
  const freshnessStaleStart = SOURCE_FRESHNESS_WINDOWS.agingMaxDays + 1;

  return (
    <main className={styles.page} data-for-ai-page id="main-content">
      <div className="tessli-container">
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>For language models and agents</p>
            <h1>Give models structured design research—not a pile of links.</h1>
            <p className={styles.lede}>
              Tessli exposes the same repository-backed source truth through
              semantic pages, JSON and Markdown representations, local research
              packs, and {TESSLI_MCP_TOOL_CATALOGUE.length} read-only MCP tools.
              Retrieval helps models find relevant context; it does not by
              itself create design taste.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="#mcp-setup">
                Configure local MCP
              </Link>
              <Link className={styles.secondaryAction} href="/boards">
                Build a research pack
              </Link>
            </div>
          </div>

          <dl
            className={styles.heroFacts}
            aria-label="Current Tessli model facts"
          >
            <div>
              <dt>Read-only MCP tools</dt>
              <dd>{TESSLI_MCP_TOOL_CATALOGUE.length}</dd>
            </div>
            <div>
              <dt>Canonical sources</dt>
              <dd>{coverage.resourceCount}</dd>
            </div>
            <div>
              <dt>Profiled sources</dt>
              <dd>{coverage.coverageCounts.profiled}</dd>
            </div>
            <div>
              <dt>Verified sources</dt>
              <dd>{coverage.coverageCounts.verified}</dd>
            </div>
          </dl>
        </header>

        <section className={styles.section} aria-labelledby="model-paths-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Two supported paths</p>
              <h2 id="model-paths-title">Use Tessli with or without MCP.</h2>
            </div>
            <p>
              Both paths begin with the same source profiles, evidence,
              limitations, Playbooks, and project decisions.
            </p>
          </div>

          <div className={styles.pathGrid}>
            <article className={styles.pathCard}>
              <p className={styles.pathNumber}>01</p>
              <h3>Without MCP</h3>
              <p>
                Give any model a stable Tessli page, a public representation, or
                a Board research pack. No Tessli-specific client integration is
                required.
              </p>
              <ol>
                <li>Browse and inspect a canonical source profile.</li>
                <li>Use its JSON or Markdown representation when useful.</li>
                <li>
                  Save sources to a local Board, record decisions, and export a
                  compact Markdown pack.
                </li>
              </ol>
              <Link href={`/resources/${profiledExample.slug}`}>
                Inspect a Profiled example <span aria-hidden="true">→</span>
              </Link>
            </article>

            <article className={styles.pathCard}>
              <p className={styles.pathNumber}>02</p>
              <h3>With local MCP</h3>
              <p>
                Run Tessli&apos;s repository-backed stdio server locally and let
                an MCP client call the {TESSLI_MCP_TOOL_CATALOGUE.length}{" "}
                focused tools directly.
              </p>
              <ol>
                <li>
                  Find a bounded task-fit source set and inspect a source guide.
                </li>
                <li>
                  Compare differentiated alternatives or a published Collection.
                </li>
                <li>
                  Create a compact research brief from the same recorded source
                  truth.
                </li>
              </ol>
              <a href="#mcp-tools">
                Review the {TESSLI_MCP_TOOL_CATALOGUE.length} tools{" "}
                <span aria-hidden="true">↓</span>
              </a>
            </article>
          </div>
        </section>

        <section
          className={`${styles.section} ${styles.setupSection}`}
          aria-labelledby="mcp-setup-title"
          id="mcp-setup"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Local stdio server</p>
              <h2 id="mcp-setup-title">Configure Tessli MCP.</h2>
            </div>
            <p>
              This is a local process, not a hosted endpoint. The MCP client
              starts Tessli from your checked-out repository and communicates
              over standard input and output.
            </p>
          </div>

          <div className={styles.setupGrid}>
            <article className={styles.setupCard}>
              <div className={styles.setupMeta}>
                <span>{TESSLI_MCP_NODE_REQUIREMENT}</span>
                <span>Server {TESSLI_MCP_SERVER_VERSION}</span>
                <span>Read only</span>
              </div>
              <h3>Install and test the server</h3>
              <p>
                Clone the public repository, install the locked dependencies,
                and start the existing <code>{TESSLI_MCP_SERVER_NAME}</code>
                server from the <code>web</code> workspace.
              </p>
              <pre
                aria-label="Tessli MCP installation commands"
                className={styles.codeBlock}
                tabIndex={0}
              >
                <code>{setupCommands}</code>
              </pre>
              <p className={styles.codeNote}>
                A direct <code>npm run mcp</code> test stays open while it waits
                for an MCP client. Stop it with <kbd>Ctrl</kbd> + <kbd>C</kbd>.
              </p>
            </article>

            <article className={styles.setupCard}>
              <div className={styles.setupMeta}>
                <span>Configuration shape</span>
                <span>Client-specific</span>
              </div>
              <h3>Let the client own the process</h3>
              <p>
                Many local MCP clients accept a configuration shaped like this.
                Replace the placeholder with the absolute path on your machine
                and adapt field names to your client&apos;s documentation.
              </p>
              <pre
                aria-label="Example local MCP client configuration"
                className={styles.codeBlock}
                tabIndex={0}
              >
                <code>{clientConfiguration}</code>
              </pre>
              <a
                className={styles.repositoryLink}
                href={repositoryUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open the Tessli repository <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>
        </section>

        <section
          className={styles.section}
          aria-labelledby="mcp-tools-title"
          id="mcp-tools"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Canonical tool catalogue</p>
              <h2 id="mcp-tools-title">Seven bounded, read-only tools.</h2>
            </div>
            <p>
              Names and descriptions below come from the same module consumed by
              the MCP server. The server performs no external search or hidden
              write operation.
            </p>
          </div>

          <ol className={styles.toolList}>
            {TESSLI_MCP_TOOL_CATALOGUE.map((tool, index) => (
              <li className={styles.toolCard} key={tool.name}>
                <div className={styles.toolHeading}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <code>{tool.name}</code>
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <dl>
                  <div>
                    <dt>Input</dt>
                    <dd>{tool.inputs}</dd>
                  </div>
                  <div>
                    <dt>Returns</dt>
                    <dd>{tool.returns}</dd>
                  </div>
                  <div>
                    <dt>Bound</dt>
                    <dd>{tool.limit}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <section
          className={styles.section}
          aria-labelledby="representations-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Model-independent access</p>
              <h2 id="representations-title">
                Public representations and private project context.
              </h2>
            </div>
            <p>
              Public source and Playbook documents contain canonical repository
              data. Browser-local Board decisions remain private until the user
              copies or downloads an export.
            </p>
          </div>

          <div className={styles.representationGrid}>
            <article className={styles.representationCard}>
              <p className={styles.cardLabel}>Source profile</p>
              <h3>{profiledExample.name}</h3>
              <p>
                A Profiled source with recorded intelligence and explicit
                interpretation boundaries.
              </p>
              <ul>
                <li>
                  <Link
                    href={`/resources/${profiledExample.slug}/profile.json`}
                  >
                    JSON representation
                  </Link>
                </li>
                <li>
                  <Link href={`/resources/${profiledExample.slug}/profile.md`}>
                    Markdown representation
                  </Link>
                </li>
              </ul>
            </article>

            <article className={styles.representationCard}>
              <p className={styles.cardLabel}>Listed fallback</p>
              <h3>{listedExample.name}</h3>
              <p>
                Listed sources remain sparse. Missing intelligence, evidence,
                and dates are not invented for a richer-looking document.
              </p>
              <ul>
                <li>
                  <Link href={`/resources/${listedExample.slug}/profile.json`}>
                    JSON representation
                  </Link>
                </li>
                <li>
                  <Link href={`/resources/${listedExample.slug}/profile.md`}>
                    Markdown representation
                  </Link>
                </li>
              </ul>
            </article>

            <article className={styles.representationCard}>
              <p className={styles.cardLabel}>Staged Playbook</p>
              <h3>{playbook.title}</h3>
              <p>
                The public document preserves outcome, audience, stages,
                inspection objectives, decisions, and every source role.
              </p>
              <ul>
                <li>
                  <Link href={`/collections/${playbook.slug}/collection.json`}>
                    JSON representation
                  </Link>
                </li>
                <li>
                  <Link href={`/collections/${playbook.slug}/collection.md`}>
                    Markdown representation
                  </Link>
                </li>
              </ul>
            </article>

            <article className={styles.representationCard}>
              <p className={styles.cardLabel}>Browser-local Board</p>
              <h3>Project research pack</h3>
              <p>
                A Board can retain goals, constraints, selected and rejected
                sources, rationale, notes, and unresolved questions. Tessli does
                not upload this browser-local state.
              </p>
              <ul>
                <li>
                  <Link href="/boards">Open local Boards</Link>
                </li>
                <li>
                  <Link href="/collections">Start from a Playbook</Link>
                </li>
              </ul>
            </article>
          </div>

          <div className={styles.packetBoundary}>
            <h3>Two packets, two purposes</h3>
            <p>
              <code>create_reference_packet</code> creates a bounded MCP handoff
              from one to ten exact sources. The richer
              <code> tessli.board-research-pack.v1</code> export comes from a
              browser-local Board and includes project-owned decisions. The MCP
              server does not read private Board storage.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="coverage-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Coverage, confidence, freshness</p>
              <h2 id="coverage-title">Depth is explicit, not implied.</h2>
            </div>
            <p>
              Catalogue presence, structured intelligence, evidence confidence,
              human review, and recency are separate signals.
            </p>
          </div>

          <div className={styles.coverageGrid}>
            <article>
              <span>{coverage.coverageCounts.listed}</span>
              <h3>Listed</h3>
              <p>
                Canonical identity, category, type, access, concise description,
                and availability. No structured intelligence is implied.
              </p>
            </article>
            <article>
              <span>{coverage.coverageCounts.profiled}</span>
              <h3>Profiled</h3>
              <p>
                Adds task fit, capabilities, content objects, platforms,
                frameworks, integrations, workflow fit, and limitations.
              </p>
            </article>
            <article>
              <span>{coverage.coverageCounts.verified}</span>
              <h3>Verified</h3>
              <p>
                Requires evidence, dates, confidence, governance, freshness, and
                explicit human-review provenance. None currently meet the full
                contract.
              </p>
            </article>
          </div>

          <div className={styles.policyGrid}>
            <article>
              <h3>Evidence confidence</h3>
              <dl>
                <div>
                  <dt>Certain</dt>
                  <dd>Every recorded evidence item is marked certain.</dd>
                </div>
                <div>
                  <dt>Likely</dt>
                  <dd>At least one valid evidence item is marked likely.</dd>
                </div>
                <div>
                  <dt>Unknown</dt>
                  <dd>Evidence is absent or contains an unsupported state.</dd>
                </div>
              </dl>
            </article>
            <article>
              <h3>Recorded freshness</h3>
              <dl>
                <div>
                  <dt>Current</dt>
                  <dd>
                    Up to {SOURCE_FRESHNESS_WINDOWS.currentMaxDays} days old.
                  </dd>
                </div>
                <div>
                  <dt>Aging</dt>
                  <dd>
                    {freshnessAgingStart}–
                    {SOURCE_FRESHNESS_WINDOWS.agingMaxDays} days old.
                  </dd>
                </div>
                <div>
                  <dt>Stale</dt>
                  <dd>{freshnessStaleStart} or more days old.</dd>
                </div>
                <div>
                  <dt>Unknown</dt>
                  <dd>Missing, invalid, or future-dated verification data.</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="governance-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Security and governance</p>
              <h2 id="governance-title">
                Know exactly what the server does not do.
              </h2>
            </div>
            <p>
              Tessli MCP is a bounded metadata interface over the checked-out
              repository. Provider access and current terms remain outside that
              boundary.
            </p>
          </div>

          <ul className={styles.boundaryList}>
            <li>
              <strong>No live provider verification.</strong>
              <span>
                It does not request websites, pricing, licences, terms, or
                current availability.
              </span>
            </li>
            <li>
              <strong>No screenshot or private-library retrieval.</strong>
              <span>
                It does not crawl, bypass access controls, proxy credentials, or
                copy paid/private content.
              </span>
            </li>
            <li>
              <strong>No project-code ingestion.</strong>
              <span>
                The server does not inspect an application repository, Figma
                file, browser session, or local design asset.
              </span>
            </li>
            <li>
              <strong>No account or credential access.</strong>
              <span>
                It has no Tessli account flow, provider login, service key, or
                user-token requirement.
              </span>
            </li>
            <li>
              <strong>No write operation.</strong>
              <span>
                Tools return structured content; they do not modify Tessli data,
                local Boards, files, providers, or external services.
              </span>
            </li>
            <li>
              <strong>No hidden Board publication.</strong>
              <span>
                Browser-local goals, notes, decisions, and unresolved questions
                remain on the device until the user exports them.
              </span>
            </li>
          </ul>
        </section>

        <aside className={styles.tasteBoundary} aria-labelledby="taste-title">
          <p className={styles.eyebrow}>Evidence before claims</p>
          <h2 id="taste-title">Retrieval is not taste.</h2>
          <p>
            Tessli can make model context smaller, more relevant, and better
            structured. A future UI-taste claim still requires browser-verified
            builds, attributable human review, selected and rejected outcomes,
            and repeated evidence across real projects.
          </p>
          <div>
            <Link href="/about">Read the product boundaries</Link>
            <Link href="/curation">Review the curation process</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
