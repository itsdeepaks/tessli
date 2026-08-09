import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TESSLI_MCP_TOOL_NAMES } from "../mcp/server.ts";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const serverPath = fileURLToPath(new URL("../mcp/server.ts", import.meta.url));

test("stdio MCP exposes only the five focused read-only V3.8 tools", async () => {
  const client = new Client(
    { name: "tessli-mcp-test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: webRoot,
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const listed = await client.listTools();

    assert.deepEqual(TESSLI_MCP_TOOL_NAMES, [
      "find_sources",
      "get_source",
      "find_alternatives",
      "get_collection",
      "create_research_brief",
    ]);
    assert.deepEqual(
      listed.tools.map((tool) => tool.name),
      [...TESSLI_MCP_TOOL_NAMES],
    );
    assert.ok(
      listed.tools.every(
        (tool) =>
          tool.annotations?.readOnlyHint === true &&
          tool.annotations?.destructiveHint === false &&
          tool.annotations?.openWorldHint === false,
      ),
    );

    const sourceResult = await client.callTool({
      name: "find_sources",
      arguments: {
        task: "Build a React animation",
        surface: "page transitions",
        framework: "react",
        needs: ["page transitions"],
      },
    });

    assert.notEqual(sourceResult.isError, true);
    assert.ok(sourceResult.structuredContent);
    assert.ok(sourceResult.structuredContent.result.sources.length <= 8);
    assert.ok(
      sourceResult.structuredContent.result.sources.some(
        (source) => source.slug === "motion",
      ),
    );

    const briefResult = await client.callTool({
      name: "create_research_brief",
      arguments: {
        task: "Build a React animation",
        surface: "page transitions",
        framework: "react",
        needs: ["page transitions"],
      },
    });

    assert.notEqual(briefResult.isError, true);
    assert.equal(
      briefResult.structuredContent.result.sourceCount,
      sourceResult.structuredContent.result.sources.length,
    );

    const unknownResult = await client.callTool({
      name: "get_source",
      arguments: { identifier: "not-a-tessli-resource" },
    });
    assert.equal(unknownResult.isError, true);
    assert.match(unknownResult.content[0].text, /Unknown Tessli resource/);
  } finally {
    await client.close();
  }
});

test("MCP source preserves the local read-only security boundary", async () => {
  const [serverSource, toolSource] = await Promise.all([
    readFile(serverPath, "utf8"),
    readFile(new URL("../lib/mcp-native-tools.ts", import.meta.url), "utf8"),
  ]);
  const combined = `${serverSource}\n${toolSource}`;

  assert.match(serverSource, /StdioServerTransport/);
  assert.doesNotMatch(combined, /\bfetch\s*\(/);
  assert.doesNotMatch(combined, /from\s+["']node:https?["']/);
  assert.doesNotMatch(combined, /\.listen\s*\(/);
  assert.doesNotMatch(combined, /process\.env/);
  assert.doesNotMatch(combined, /console\.log/);
  assert.doesNotMatch(combined, /\bwriteFile\b/);
  assert.doesNotMatch(combined, /\breadFile\b/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(combined, /provider token|service[- ]role/i);
  assert.doesNotMatch(
    combined,
    /verify_resource|search_resources|compare_resources/,
  );
});
