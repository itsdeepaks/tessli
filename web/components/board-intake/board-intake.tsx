"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  boardStoreEvent,
  boardStoreKey,
  createBoard,
  readBoards,
  writeBoards,
  type ProjectBoard,
} from "@/components/project-boards/board-store";
import type { ResourceCardData } from "@/components/resource-card/resource-card";

import styles from "./board-intake.module.css";

type BoardIntakeProps = Readonly<{
  resource: Pick<ResourceCardData, "id" | "name">;
  className?: string;
}>;

function boardItem(resourceId: string) {
  return {
    resourceId,
    note: "",
    decision: "undecided" as const,
    rationale: "",
  };
}

export function BoardIntake({ resource, className }: BoardIntakeProps) {
  const [boards, setBoards] = useState<readonly ProjectBoard[]>([]);
  const [boardName, setBoardName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameId = useId();
  const errorId = useId();

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

  function announce(message: string, showFeedback = false) {
    setAnnouncement(message);
    setFeedback(showFeedback ? message : "");
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setFeedback("");
    dialog.showModal();
  }

  function addToBoard(board: ProjectBoard) {
    const currentBoards = readBoards();
    const currentBoard = currentBoards.find(({ id }) => id === board.id);
    if (!currentBoard) {
      announce("That Board is no longer available in this browser.", true);
      return;
    }
    if (currentBoard.items.some((item) => item.resourceId === resource.id)) {
      announce(`${resource.name} is already on ${currentBoard.name}.`, true);
      return;
    }

    const next = currentBoards.map((current) =>
      current.id === currentBoard.id
        ? {
            ...current,
            updatedAt: new Date().toISOString(),
            items: [...current.items, boardItem(resource.id)],
          }
        : current,
    );
    if (!writeBoards(next)) {
      announce(
        "This browser could not save the Board. Check browser storage and try again.",
        true,
      );
      return;
    }
    setBoards(next);
    announce(`${resource.name} added to ${currentBoard.name}.`);
    closeDialog();
  }

  function createBoardAndAddResource() {
    const name = boardName.trim();
    if (!name) {
      const message = "Enter a name for the new Board.";
      announce(message, true);
      nameInputRef.current?.focus();
      return;
    }

    const board = createBoard(name);
    const next = [
      ...readBoards(),
      {
        ...board,
        items: [boardItem(resource.id)],
      },
    ];
    if (!writeBoards(next)) {
      announce(
        "This browser could not save the Board. Check browser storage and try again.",
        true,
      );
      return;
    }
    setBoards(next);
    setBoardName("");
    announce(`${board.name} created and ${resource.name} added.`);
    closeDialog();
  }

  return (
    <div className={`${styles.intake}${className ? ` ${className}` : ""}`}>
      <p aria-live="polite" className={styles.visuallyHidden}>
        {announcement}
      </p>
      <button
        aria-haspopup="dialog"
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        Add to Board
      </button>
      <dialog
        aria-labelledby={titleId}
        className={styles.dialog}
        onClose={() => {
          window.requestAnimationFrame(() => triggerRef.current?.focus());
        }}
        ref={dialogRef}
      >
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>Private browser workspace</p>
            <h2 id={titleId}>Add {resource.name} to a Board</h2>
          </div>
          <button
            aria-label="Close Board picker"
            onClick={closeDialog}
            type="button"
          >
            Close
          </button>
        </div>
        <p className={styles.copy}>
          Boards stay in this browser and are not uploaded or synced.
        </p>
        {feedback ? (
          <p className={styles.feedback} id={errorId} role="status">
            {feedback}
          </p>
        ) : null}
        {boards.length > 0 ? (
          <div className={styles.boardList} aria-label="Choose a Board">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => addToBoard(board)}
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
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            createBoardAndAddResource();
          }}
        >
          <label htmlFor={nameId}>
            {boards.length > 0 ? "Or create a new Board" : "Board name"}
          </label>
          <input
            aria-describedby={feedback ? errorId : undefined}
            aria-invalid={feedback === "Enter a name for the new Board."}
            autoComplete="off"
            autoFocus
            id={nameId}
            maxLength={80}
            onChange={(event) => {
              setBoardName(event.target.value);
              if (feedback) setFeedback("");
            }}
            placeholder="Homepage research"
            ref={nameInputRef}
            value={boardName}
          />
          <button type="submit">Create Board and add source</button>
        </form>
      </dialog>
    </div>
  );
}
