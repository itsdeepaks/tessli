import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TESSLI_MCP_SERVER_NAME,
  TESSLI_MCP_SERVER_VERSION,
  TESSLI_MCP_TOOL_CATALOGUE,
  TESSLI_MCP_TOOL_NAMES,
} from "../lib/mcp-tool-catalogue.ts";

const currentFile = fileURLToPath(import.meta.url);
const webRoot = path.resolve(path.dirname(currentFile), "..");

async function read(relativePath) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

test("shared MCP catalogue preserves the exact five-tool public contract", () => {
  assert.equal(TESSLI_MCP_SERVER_NAME, "tessli-native-metadata");
  assert.equal(TESSLI_MCP_SERVER_VERSION, "0.2.0");
  assert.deepEqual(TESSLI_MCP_TOOL_NAMES, [
    "find_sources",
    "get_source",
    "find_alternatives",
    "get_collection",
    "create_research_brief",
  ]);
  assert.equal(TESSLI_MCP_TOOL_CATALOGUE.length, 5);
  assert.equal(new Set(TESSLI_MCP_TOOL_NAMES).size, 5);

  for (const tool of TESSLI_MCP_TOOL_CATALOGUE) {
    assert.ok(tool.title.length > 0);
    assert.ok(tool.description.length > 0);
    assert.ok(tool.inputs.length > 0);
    assert.ok(tool.returns.length > 0);
    assert.ok(tool.limit.length > 0);
  }
});

test("MCP server consumes shared names and descriptions without expanding scope", async () => {
  const server = await read("mcp/server.ts");

  assert.match(server, /from "\.\.\/lib\/mcp-tool-catalogue\.ts"/);
  assert.match(server, /getTessliMcpToolMetadata\("find_sources"\)/);
  assert.match(server, /getTessliMcpToolMetadata\("create_research_brief"\)/);
  assert.match(server, /name: TESSLI_MCP_SERVER_NAME/);
  assert.match(server, /version: TESSLI_MCP_SERVER_VERSION/);
  assert.match(server, /title: findSourcesTool\.title/);
  assert.match(server, /description: researchBriefTool\.description/);
  assert.doesNotMatch(
    server,
    /search_resources|get_resource_profile|compare_resources|verify_resource/,
  );
  assert.doesNotMatch(server, /Http|SSE|OAuth|\.listen\s*\(/);
});

test("For AI page leads with the task-to-agent workflow and current access truth", async () => {
  const page = await read("app/for-ai/page.tsx");

  assert.match(page, /title: "For AI"/);
  assert.match(page, /data-for-ai-page/);
  assert.match(page, /id="main-content"/);
  assert.match(page, /data-for-ai-workflow/);
  assert.match(page, /data-for-ai-example/);
  assert.match(page, /data-for-ai-representations/);
  assert.match(page, /data-for-ai-board-boundary/);
  assert.match(page, /data-for-ai-local-mcp/);
  assert.match(page, /data-for-ai-remote-status="unavailable"/);
  assert.match(page, /data-for-ai-access-routes/);
  assert.match(page, /data-for-ai-boundaries/);
  assert.match(page, /Turn research into an agent’s next clear move./);
  assert.match(page, /From task to reviewed implementation./);
  assert.match(page, /What an agent receives/);
  assert.match(page, /A concrete task, kept compact/);
  assert.match(page, /Access without MCP/);
  assert.match(page, /Local MCP is the current transport./);
  assert.match(page, /Choose the recorded access route./);
  assert.match(
    page,
    /Keep project context private and provider boundaries clear/,
  );
  assert.match(page, /npm run mcp/);
  assert.match(page, /profile\.json/);
  assert.match(page, /profile\.md/);
  assert.match(page, /Export their compact Markdown[\s\S]*?JSON/);
  assert.match(page, /do not read a browser Board[\s\S]*?automatically/);
  assert.match(page, /Remote and hosted MCP are unavailable today/);
  assert.match(page, /checked-out repository/);
  assert.match(page, /read-only/);
  assert.doesNotMatch(
    page,
    /getSourceContractSummary|SOURCE_FRESHNESS_WINDOWS/,
  );
  assert.doesNotMatch(page, /coverageGrid|policyGrid|coverageCounts/);
  assert.doesNotMatch(page, /\b(?:coverage|evidence|verification)\b/i);
  assert.doesNotMatch(page, /\btaste\b/i);
});

test("For AI route is discoverable only after its page exists", async () => {
  const [navigation, footer, sitemap] = await Promise.all([
    read("components/site-header/navigation.ts"),
    read("components/site-footer/footer-navigation.ts"),
    read("app/sitemap.ts"),
  ]);

  assert.match(
    navigation,
    /label: "For AI"[\s\S]*?href: "\/for-ai"[\s\S]*?available: true/,
  );
  assert.match(footer, /label: "For AI", href: "\/for-ai"/);
  assert.match(sitemap, /"\/for-ai"/);
});

test("For AI visual contract is route-scoped, responsive, and overflow safe", async () => {
  const css = await read("app/for-ai/for-ai.module.css");

  assert.match(css, /\.hero \{/);
  assert.match(css, /\.codeBlock \{[\s\S]*?overflow-x: auto/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(
    css,
    /backdrop-filter|filter: blur|border-radius: 1[2-9]px|animation:/,
  );
});
