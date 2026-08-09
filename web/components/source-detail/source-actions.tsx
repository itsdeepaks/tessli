"use client";

import { useEffect, useRef, useState } from "react";

import {
  boardStoreEvent,
  boardStoreKey,
  createBoard,
  readBoards,
  writeBoards,
  type ProjectBoard,
} from "@/components/project-boards/board-store";
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
  const [boards, setBoards] = useState<readonly ProjectBoard[]>([]);
  const [boardName, setBoardName] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const boardTriggerRef = useRef<HTMLButtonElement>(null);
  const boardDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const synchronize = () =>
      setSaved(readSavedResourceIds([resource]).includes(resource.id));
    synchronize();
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [resource]);

  useEffect(() => {
    const synchronize = () => setBoards(readBoards());
    synchronize();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === boardStoreKey) {
        synchronize();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(boardStoreEvent, synchronize);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(boardStoreEvent, synchronize);
    };
  }, []);

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

  function closeBoardPicker() {
    boardDialogRef.current?.close();
  }

  function openBoardPicker() {
    const dialog = boardDialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  function updateBoardWithResource(board: ProjectBoard) {
    const currentBoards = readBoards();
    const currentBoard = currentBoards.find(({ id }) => id === board.id);
    if (!currentBoard) {
      setAnnouncement("That Board is no longer available in this browser.");
      return;
    }
    if (currentBoard.items.some((item) => item.resourceId === resource.id)) {
      setAnnouncement(`${resource.name} is already on ${currentBoard.name}.`);
      return;
    }

    const next = currentBoards.map((current) =>
      current.id === currentBoard.id
        ? {
            ...current,
            updatedAt: new Date().toISOString(),
            items: [
              ...current.items,
              {
                resourceId: resource.id,
                note: "",
                decision: "undecided" as const,
                rationale: "",
              },
            ],
          }
        : current,
    );
    if (!writeBoards(next)) {
      setAnnouncement(
        "This browser could not save the Board. Check browser storage and try again.",
      );
      return;
    }
    setBoards(next);
    setAnnouncement(`${resource.name} added to ${currentBoard.name}.`);
    closeBoardPicker();
  }

  function createBoardAndAddResource() {
    const name = boardName.trim();
    if (!name) return;
    const board = createBoard(name);
    const next = [
      ...readBoards(),
      {
        ...board,
        items: [
          {
            resourceId: resource.id,
            note: "",
            decision: "undecided" as const,
            rationale: "",
          },
        ],
      },
    ];
    if (!writeBoards(next)) {
      setAnnouncement(
        "This browser could not save the Board. Check browser storage and try again.",
      );
      return;
    }
    setBoards(next);
    setBoardName("");
    setAnnouncement(`${board.name} created and ${resource.name} added.`);
    closeBoardPicker();
  }

  return (
    <div className={styles.wrapper}>
      <p aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
      <button aria-pressed={saved} onClick={toggleSaved} type="button">
        {saved ? "Saved" : "Save source"}
      </button>
      <button
        aria-haspopup="dialog"
        onClick={openBoardPicker}
        ref={boardTriggerRef}
        type="button"
      >
        Add to Board
      </button>
      {resource.status === "unavailable" ? (
        <span className={styles.unavailable}>
          Provider currently unavailable
        </span>
      ) : (
        <a href={resource.url} rel="noopener noreferrer" target="_blank">
          Visit source ↗
        </a>
      )}
      <dialog
        aria-labelledby="source-board-picker-title"
        className={styles.boardDialog}
        onCancel={(event) => {
          event.preventDefault();
          closeBoardPicker();
        }}
        onClose={() => {
          window.requestAnimationFrame(() => boardTriggerRef.current?.focus());
        }}
        ref={boardDialogRef}
      >
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.dialogEyebrow}>Private browser workspace</p>
            <h2 id="source-board-picker-title">
              Add {resource.name} to a Board
            </h2>
          </div>
          <button
            aria-label="Close Board picker"
            onClick={closeBoardPicker}
            type="button"
          >
            Close
          </button>
        </div>
        <p className={styles.dialogCopy}>
          Boards stay in this browser and are not uploaded or synced.
        </p>
        {boards.length > 0 ? (
          <div className={styles.boardList} aria-label="Choose a Board">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => updateBoardWithResource(board)}
                type="button"
              >
                <span>{board.name}</span>
                <small>{board.items.length} sources</small>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.emptyBoards}>
            Create a Board to keep this source with your project decisions.
          </p>
        )}
        <form
          className={styles.createBoardForm}
          onSubmit={(event) => {
            event.preventDefault();
            createBoardAndAddResource();
          }}
        >
          <label>
            <span>
              {boards.length > 0 ? "Or create a new Board" : "Board name"}
            </span>
            <input
              autoComplete="off"
              autoFocus
              maxLength={80}
              onChange={(event) => setBoardName(event.target.value)}
              placeholder="Homepage research"
              value={boardName}
            />
          </label>
          <button disabled={!boardName.trim()} type="submit">
            Create Board and add source
          </button>
        </form>
      </dialog>
    </div>
  );
}
