import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import {
  TESSLI_MCP_SERVER_NAME,
  TESSLI_MCP_SERVER_VERSION,
  TESSLI_MCP_TOOL_NAMES,
  getTessliMcpToolMetadata,
} from "../lib/mcp-tool-catalogue.ts";
import {
  NATIVE_MCP_LIMITS,
  NativeMcpInputError,
  createNativeResearchBrief,
  findNativeAlternatives,
  findNativeSources,
  getNativeCollection,
  getNativeSource,
} from "../lib/mcp-native-tools.ts";

export { TESSLI_MCP_TOOL_NAMES };

const findSourcesTool = getTessliMcpToolMetadata("find_sources");
const sourceTool = getTessliMcpToolMetadata("get_source");
const alternativesTool = getTessliMcpToolMetadata("find_alternatives");
const collectionTool = getTessliMcpToolMetadata("get_collection");
const researchBriefTool = getTessliMcpToolMetadata("create_research_brief");

const readOnlyAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .describe("Exact Tessli source or collection stable ID or slug.");

const optionalTaskTextSchema = z.string().trim().min(1).max(160).optional();

const taskInputSchema = {
  task: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .describe("The design or frontend task to research."),
  surface: optionalTaskTextSchema.describe(
    "Optional target surface, such as a landing page or settings form.",
  ),
  framework: optionalTaskTextSchema.describe(
    "Optional framework or platform constraint.",
  ),
  needs: z
    .array(z.string().trim().min(1).max(120))
    .max(8)
    .optional()
    .describe("Optional recorded capabilities or materials the task needs."),
  exclusions: z
    .array(z.string().trim().min(1).max(120))
    .max(8)
    .optional()
    .describe("Optional recorded metadata to exclude from the shortlist."),
};

const structuredOutputSchema = {
  result: z.record(z.string(), z.unknown()),
};

function toSuccessResult(result: object) {
  const structuredResult = { ...result };
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredResult, null, 2),
      },
    ],
    structuredContent: { result: structuredResult },
  };
}

function toErrorResult(error: unknown) {
  const isInputError = error instanceof NativeMcpInputError;
  const message = isInputError
    ? error.message
    : "The Tessli native metadata tool failed safely.";

  if (!isInputError) {
    console.error(
      "[tessli-mcp] Native tool failure:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  const structuredResult = {
    error: message,
    retryable: false,
  };

  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
    structuredContent: { result: structuredResult },
  };
}

export function createTessliMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: TESSLI_MCP_SERVER_NAME,
      version: TESSLI_MCP_SERVER_VERSION,
    },
    {
      instructions:
        "Use Tessli to retrieve task-fit design sources, inspect recorded source guidance, compare differentiated alternatives, review collections, and create compact research briefs. This server is local, read-only, and repository-backed. It performs no provider browsing or verification, browser-local Board access, credential access, project-code ingestion, or write operation.",
    },
  );

  server.registerTool(
    findSourcesTool.name,
    {
      title: findSourcesTool.title,
      description: findSourcesTool.description,
      inputSchema: taskInputSchema,
      outputSchema: structuredOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        return toSuccessResult(findNativeSources(input));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    sourceTool.name,
    {
      title: sourceTool.title,
      description: sourceTool.description,
      inputSchema: { identifier: identifierSchema },
      outputSchema: structuredOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ identifier }) => {
      try {
        return toSuccessResult(getNativeSource(identifier));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    alternativesTool.name,
    {
      title: alternativesTool.title,
      description: alternativesTool.description,
      inputSchema: {
        identifier: identifierSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(NATIVE_MCP_LIMITS.alternatives)
          .default(NATIVE_MCP_LIMITS.alternatives),
      },
      outputSchema: structuredOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ identifier, limit }) => {
      try {
        return toSuccessResult(findNativeAlternatives(identifier, limit));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    collectionTool.name,
    {
      title: collectionTool.title,
      description: collectionTool.description,
      inputSchema: { identifier: identifierSchema },
      outputSchema: structuredOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ identifier }) => {
      try {
        return toSuccessResult(getNativeCollection(identifier));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    researchBriefTool.name,
    {
      title: researchBriefTool.title,
      description: researchBriefTool.description,
      inputSchema: taskInputSchema,
      outputSchema: structuredOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        return toSuccessResult(createNativeResearchBrief(input));
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  return server;
}

export async function runTessliMcpServer(): Promise<void> {
  const server = createTessliMcpServer();
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  await server.connect(transport);
  console.error("Tessli native metadata MCP running on stdio.");
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  void runTessliMcpServer().catch((error: unknown) => {
    console.error(
      "Tessli MCP failed to start:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exit(1);
  });
}
