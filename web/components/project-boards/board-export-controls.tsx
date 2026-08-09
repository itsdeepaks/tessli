"use client";

import { useMemo, useState } from "react";

import {
  createBoardResearchPack,
  type BoardResearchPackSource,
} from "@/lib/board-research-pack.mjs";
import { createBoardAgentHandoff } from "@/lib/board-agent-handoff.mjs";
import type { ProjectBoard } from "./board-store";
import styles from "./board-export-controls.module.css";

type Props = Readonly<{
  board: ProjectBoard;
  resources: readonly BoardResearchPackSource[];
}>;

type ExportStatus = Readonly<{
  signature: string;
  message: string;
}>;

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BoardExportControls({ board, resources }: Props) {
  const [generatedAt, setGeneratedAt] = useState(todayLocal);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const resultSignature = `${board.updatedAt}|${generatedAt}`;

  const result = useMemo(
    () =>
      createBoardResearchPack({
        contractVersion: 1,
        generatedAt,
        board,
        sources: resources,
      }),
    [board, generatedAt, resources],
  );
  const handoff = useMemo(
    () =>
      createBoardAgentHandoff({
        contractVersion: 1,
        generatedAt,
        board,
        sources: resources,
      }),
    [board, generatedAt, resources],
  );

  const announce = (message: string) => {
    setStatus({ signature: resultSignature, message });
  };

  const copyMarkdown = async () => {
    if (!result.ok) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }
      await navigator.clipboard.writeText(result.markdown);
      announce("Research pack copied as Markdown.");
    } catch {
      announce("Copy failed. Download the Markdown file instead.");
    }
  };

  const downloadMarkdown = () => {
    if (!result.ok) return;
    const blob = new Blob([result.markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = result.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    announce(`${result.filename} downloaded.`);
  };

  const copyJson = async () => {
    if (!handoff.ok) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }
      await navigator.clipboard.writeText(handoff.json);
      announce("Agent handoff copied as JSON.");
    } catch {
      announce("Copy failed. Download the JSON file instead.");
    }
  };

  const downloadJson = () => {
    if (!handoff.ok) return;
    const blob = new Blob([handoff.json], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = handoff.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    announce(`${handoff.filename} downloaded.`);
  };

  return (
    <section
      className={styles.exportPanel}
      aria-labelledby="board-export-title"
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Local research handoff</p>
          <h2 id="board-export-title">Export research pack</h2>
          <p>
            Copy or download deterministic Markdown. Board content stays in this
            browser and is not uploaded.
          </p>
        </div>
        <label className={styles.dateField}>
          <span>Generated date</span>
          <input
            onChange={(event) => setGeneratedAt(event.target.value)}
            type="date"
            value={generatedAt}
          />
        </label>
      </div>

      {!result.ok ? (
        <div className={styles.validation} role="status">
          <strong>
            Complete these requirements before exporting or creating a compact
            JSON handoff:
          </strong>
          <ul>
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.ready}>
          Ready:{" "}
          {board.items.filter((item) => item.decision === "selected").length}{" "}
          selected reference(s), filename <code>{result.filename}</code>.
        </p>
      )}

      {result.ok && !handoff.ok ? (
        <div className={styles.validation} role="status">
          <strong>Compact JSON handoff is unavailable:</strong>
          <ul>
            {handoff.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button disabled={!result.ok} onClick={copyMarkdown} type="button">
          Copy Markdown
        </button>
        <button disabled={!result.ok} onClick={downloadMarkdown} type="button">
          Download .md
        </button>
        {handoff.ok ? (
          <>
            <button onClick={copyJson} type="button">
              Copy JSON
            </button>
            <button onClick={downloadJson} type="button">
              Download .json
            </button>
          </>
        ) : null}
      </div>

      <p className={styles.recipe}>
        To use this with an agent, copy or download it, then explicitly paste or
        attach it to the agent. Tessli and the local MCP do not read this
        browser Board automatically. Board data is not uploaded or synced.
      </p>

      <p className={styles.status} aria-live="polite">
        {status?.signature === resultSignature ? status.message : ""}
      </p>
    </section>
  );
}
