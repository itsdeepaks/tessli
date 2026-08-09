export const TESSLI_MCP_SERVER_NAME = "tessli-native-metadata" as const;
export const TESSLI_MCP_SERVER_VERSION = "0.2.0" as const;
export const TESSLI_MCP_NODE_REQUIREMENT = "Node.js 22 or newer" as const;

export const TESSLI_MCP_TOOL_CATALOGUE = [
  {
    name: "find_sources",
    title: "Find task-fit Tessli sources",
    description:
      "Retrieve up to eight deterministic, explained source choices for a structured design or frontend task. Results include recorded fit reasons, caveats, alternatives, and access routes; no provider is queried.",
    inputs: "A task, with optional surface, framework, needs, and exclusions.",
    returns:
      "A normalized task brief and up to eight ranked canonical source choices.",
    limit: "Up to 8 sources",
  },
  {
    name: "get_source",
    title: "Get Tessli source guidance",
    description:
      "Resolve one exact stable source ID or slug into compact, canonical guidance: what it helps with, what to inspect, recorded access routes, limitations, and differentiated alternatives.",
    inputs: "One exact stable source ID or slug.",
    returns:
      "One SourceProfile-derived guide with recorded AccessRoute and caveat truth.",
    limit: "1 source; up to 2 alternatives",
  },
  {
    name: "find_alternatives",
    title: "Find differentiated source alternatives",
    description:
      "Find up to four recorded alternatives for one exact Tessli source. Each alternative states a recorded difference rather than a universal ranking.",
    inputs: "One exact stable source ID or slug and an optional limit.",
    returns:
      "A canonical source guide and a bounded ordered set of differentiated alternatives.",
    limit: "1–4 alternatives",
  },
  {
    name: "get_collection",
    title: "Get Tessli collection guidance",
    description:
      "Resolve one published Tessli collection by exact stable ID or slug with its ordered stages, recorded source roles, and compact canonical source guidance.",
    inputs: "One exact published collection ID or slug.",
    returns:
      "One collection with its preserved editorial order and source access guidance.",
    limit: "1 collection; up to 12 sources",
  },
  {
    name: "create_research_brief",
    title: "Create a task research brief",
    description:
      "Create a compact, deterministic research handoff from the same structured task retrieval used by find_sources. It routes agents to recorded provider access paths without copying provider content.",
    inputs: "A task, with optional surface, framework, needs, and exclusions.",
    returns:
      "A normalized brief, up to eight explained source choices, and concise next-step guidance.",
    limit: "Up to 8 sources",
  },
] as const;

export type TessliMcpToolMetadata = (typeof TESSLI_MCP_TOOL_CATALOGUE)[number];
export type TessliMcpToolName = TessliMcpToolMetadata["name"];

export const TESSLI_MCP_TOOL_NAMES = Object.freeze(
  TESSLI_MCP_TOOL_CATALOGUE.map((tool) => tool.name),
) as readonly TessliMcpToolName[];

export function getTessliMcpToolMetadata(
  name: TessliMcpToolName,
): TessliMcpToolMetadata {
  const metadata = TESSLI_MCP_TOOL_CATALOGUE.find(
    (candidate) => candidate.name === name,
  );

  if (!metadata) {
    throw new Error(`Missing Tessli MCP tool metadata for ${name}.`);
  }

  return metadata;
}
