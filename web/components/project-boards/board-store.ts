export const boardStoreKey = "tessli-project-boards-v1";
export const boardStoreEvent = "tessli-project-boards-change";

export type ProjectBoardDecision = "undecided" | "selected" | "rejected";

export type ProjectBoardItem = Readonly<{
  resourceId: string;
  note: string;
  decision: ProjectBoardDecision;
  rationale: string;
}>;

export type ProjectBoard = Readonly<{
  id: string;
  name: string;
  goal: string;
  audience: string;
  constraints: string;
  unresolvedQuestions: readonly string[];
  createdAt: string;
  updatedAt: string;
  items: readonly ProjectBoardItem[];
}>;

function normalizeBoardItem(value: unknown): ProjectBoardItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.resourceId !== "string" || typeof item.note !== "string") {
    return null;
  }
  const decision =
    item.decision === "selected" || item.decision === "rejected"
      ? item.decision
      : "undecided";
  return {
    resourceId: item.resourceId,
    note: item.note,
    decision,
    rationale: typeof item.rationale === "string" ? item.rationale : "",
  };
}

function normalizeBoard(value: unknown): ProjectBoard | null {
  if (!value || typeof value !== "object") return null;
  const board = value as Record<string, unknown>;
  if (
    typeof board.id !== "string" ||
    typeof board.name !== "string" ||
    typeof board.goal !== "string" ||
    typeof board.constraints !== "string" ||
    typeof board.createdAt !== "string" ||
    typeof board.updatedAt !== "string" ||
    !Array.isArray(board.items)
  ) {
    return null;
  }
  const items = board.items.map(normalizeBoardItem);
  if (items.some((item) => item === null)) return null;
  return {
    id: board.id,
    name: board.name,
    goal: board.goal,
    audience: typeof board.audience === "string" ? board.audience : "",
    constraints: board.constraints,
    unresolvedQuestions: Array.isArray(board.unresolvedQuestions)
      ? board.unresolvedQuestions.filter(
          (question): question is string => typeof question === "string",
        )
      : [],
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    items: items as readonly ProjectBoardItem[],
  };
}

export function parseBoards(value: string | null): readonly ProjectBoard[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeBoard)
      .filter((board): board is ProjectBoard => board !== null);
  } catch {
    return [];
  }
}

export function readBoards(): readonly ProjectBoard[] {
  if (typeof window === "undefined") return [];
  try {
    return parseBoards(window.localStorage.getItem(boardStoreKey));
  } catch {
    return [];
  }
}

export function writeBoards(boards: readonly ProjectBoard[]) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(boardStoreKey, JSON.stringify(boards));
    window.dispatchEvent(new CustomEvent(boardStoreEvent));
    return true;
  } catch {
    return false;
  }
}

export function createBoard(name: string): ProjectBoard {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    goal: "",
    audience: "",
    constraints: "",
    unresolvedQuestions: [],
    createdAt: now,
    updatedAt: now,
    items: [],
  };
}
