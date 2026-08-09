export const BOARD_AGENT_HANDOFF_CONTRACT = "tessli.board-agent-handoff.v1";

const SELECTED_SOURCE_LIMIT = 12;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLineEndings(value) {
  return String(value ?? "").replace(/\r\n?/gu, "\n");
}

function normalizedText(value) {
  return normalizeLineEndings(value)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .trim();
}

function optionalText(value) {
  const text = normalizedText(value);
  return text || null;
}

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;

  const daysByMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximumDay = month === 2 && isLeapYear ? 29 : daysByMonth[month - 1];
  return day >= 1 && day <= maximumDay;
}

function sourceMap(sources) {
  const map = new Map();
  for (const source of sources ?? []) {
    if (!isPlainObject(source) || typeof source.id !== "string") continue;
    if (!map.has(source.id)) map.set(source.id, source);
  }
  return map;
}

function compactStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => optionalText(item))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeDecision(value) {
  if (value === "selected" || value === "rejected") return value;
  return "undecided";
}

function handoffRecord(item, source) {
  const taskGuidance = source
    ? compactStringList(
        source.taskGuidance ?? source.bestFor ?? source.workflowFit,
      )
    : [];
  const caveats = source
    ? compactStringList(source.caveats ?? source.limitations)
    : [];

  return {
    source: {
      id: typeof source?.id === "string" ? source.id : item.resourceId,
      name: optionalText(source?.name),
      url: optionalText(source?.url),
      domain: optionalText(source?.domain),
      canonicalSourceAvailable: Boolean(source),
      taskGuidance,
      caveats,
    },
    projectDecision: {
      decision: normalizeDecision(item.decision),
      rationale: optionalText(item.rationale),
      note: optionalText(item.note),
    },
  };
}

function sanitizeFilename(boardName) {
  const ascii = normalizedText(boardName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72)
    .replace(/-+$/gu, "");

  return ascii
    ? `tessli-${ascii}-agent-handoff.json`
    : "tessli-agent-handoff.json";
}

function validateInput(input) {
  const errors = [];
  if (!isPlainObject(input)) return ["Agent-handoff input is missing."];
  if (input.contractVersion !== 1) {
    errors.push("Agent-handoff contract version must be 1.");
  }
  if (!isValidDate(String(input.generatedAt ?? ""))) {
    errors.push("Generated date must be a valid YYYY-MM-DD value.");
  }
  if (!isPlainObject(input.board)) {
    errors.push("Project Board is missing.");
    return errors;
  }

  const board = input.board;
  if (!normalizedText(board.name)) errors.push("Board name is required.");
  if (!normalizedText(board.goal)) errors.push("Project goal is required.");
  if (!Array.isArray(board.items)) {
    errors.push("Board sources are invalid.");
    return errors;
  }

  const seen = new Set();
  let selected = 0;
  for (const item of board.items) {
    if (!isPlainObject(item) || typeof item.resourceId !== "string") {
      errors.push("Every Board source requires a stable resource ID.");
      continue;
    }
    if (seen.has(item.resourceId)) {
      errors.push(`Duplicate Board source: ${item.resourceId}.`);
    }
    seen.add(item.resourceId);
    if (item.decision === "selected") selected += 1;
  }

  if (selected === 0) {
    errors.push("Select at least one source before exporting.");
  }
  if (selected > SELECTED_SOURCE_LIMIT) {
    errors.push(
      `Select no more than ${SELECTED_SOURCE_LIMIT} sources before exporting.`,
    );
  }
  return errors;
}

export function createBoardAgentHandoff(input) {
  const errors = validateInput(input);
  if (errors.length > 0) return { ok: false, errors };

  const board = input.board;
  const byId = sourceMap(input.sources);
  const selected = [];
  const rejected = [];
  const undecided = [];

  for (const item of board.items) {
    const decision = normalizeDecision(item.decision);
    const record = handoffRecord(item, byId.get(item.resourceId));
    if (decision === "selected") selected.push(record);
    else if (decision === "rejected") rejected.push(record);
    else undecided.push(record);
  }

  const artifact = {
    contract: BOARD_AGENT_HANDOFF_CONTRACT,
    version: 1,
    generatedAt: input.generatedAt,
    boundaries: {
      localContext:
        "This handoff is user-selected local project context provided only through an explicit export.",
      sourceTruth:
        "Canonical source details are repository-managed context, not live/provider truth.",
      modelAccess:
        "This export does not grant a model automatic access to local Board data or provider content.",
    },
    project: {
      name: normalizedText(board.name),
      goal: normalizedText(board.goal),
      audience: optionalText(board.audience),
      constraints: optionalText(board.constraints),
      unresolvedQuestions: Array.isArray(board.unresolvedQuestions)
        ? board.unresolvedQuestions.map(optionalText).filter(Boolean)
        : [],
    },
    sources: { selected, rejected, undecided },
  };

  return {
    ok: true,
    json: `${JSON.stringify(artifact, null, 2)}\n`,
    filename: sanitizeFilename(board.name),
  };
}
