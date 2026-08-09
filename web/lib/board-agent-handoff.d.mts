export type BoardAgentHandoffDecision = "undecided" | "selected" | "rejected";

export interface BoardAgentHandoffSource {
  id: string;
  name?: string;
  url?: string;
  domain?: string;
  taskGuidance?: readonly string[];
  bestFor?: readonly string[];
  workflowFit?: readonly string[];
  caveats?: readonly string[];
  limitations?: readonly string[];
}

export interface BoardAgentHandoffItem {
  resourceId: string;
  note?: string;
  decision?: BoardAgentHandoffDecision;
  rationale?: string;
}

export interface BoardAgentHandoffBoard {
  name: string;
  goal: string;
  audience?: string;
  constraints?: string;
  unresolvedQuestions?: readonly string[];
  items: readonly BoardAgentHandoffItem[];
}

export interface BoardAgentHandoffInput {
  contractVersion: 1;
  generatedAt: string;
  board: BoardAgentHandoffBoard;
  sources?: readonly BoardAgentHandoffSource[];
}

export type BoardAgentHandoffResult =
  | { ok: true; json: string; filename: string }
  | { ok: false; errors: string[] };

export const BOARD_AGENT_HANDOFF_CONTRACT: "tessli.board-agent-handoff.v1";

export function createBoardAgentHandoff(
  input: BoardAgentHandoffInput,
): BoardAgentHandoffResult;
