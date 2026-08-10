import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  REMOTE_MCP_MAX_BODY_BYTES,
  REMOTE_MCP_MAX_RATE_KEYS,
  REMOTE_MCP_RATE_LIMIT,
  REMOTE_MCP_RATE_WINDOW_MS,
  getRemoteMcpConfiguration,
  handleRemoteMcpRequest,
} from "../lib/mcp-http.ts";
import { TESSLI_MCP_TOOL_NAMES } from "../mcp/server.ts";

const remoteMcpEnvKeys = [
  "TESSLI_REMOTE_MCP_ENABLED",
  "TESSLI_REMOTE_MCP_ALLOWED_HOSTS",
  "TESSLI_REMOTE_MCP_ALLOWED_ORIGINS",
];

function restoreEnvironment(snapshot) {
  for (const key of remoteMcpEnvKeys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

async function withRemoteMcpEnvironment(environment, callback) {
  const snapshot = Object.fromEntries(
    remoteMcpEnvKeys.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of remoteMcpEnvKeys) delete process.env[key];
    Object.assign(process.env, environment);
    return await callback();
  } finally {
    restoreEnvironment(snapshot);
  }
}

function requestFor(body, options = {}) {
  const encoded = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Headers({
    host: "mcp.tessli.test",
    origin: "https://app.tessli.test",
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(encoded)),
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-03-26",
    ...options.headers,
  });

  return new Request("https://mcp.tessli.test/api/mcp", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "OPTIONS" ? undefined : encoded,
  });
}

const enabledEnvironment = {
  TESSLI_REMOTE_MCP_ENABLED: "true",
  TESSLI_REMOTE_MCP_ALLOWED_HOSTS: "mcp.tessli.test",
  TESSLI_REMOTE_MCP_ALLOWED_ORIGINS: "https://app.tessli.test",
};

function assertSecurityHeaders(response) {
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /default-src 'none'/,
  );
  assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
}

test("remote MCP remains safely absent by default without parsing or transporting requests", async () => {
  await withRemoteMcpEnvironment({}, async () => {
    const response = await handleRemoteMcpRequest(
      new Request("https://mcp.tessli.test/api/mcp", {
        method: "POST",
        body: "this is deliberately not JSON",
      }),
    );

    assert.equal(response.status, 404);
    assertSecurityHeaders(response);
  });
});

test("remote MCP requires non-wildcard exact host and origin allowlists", async () => {
  await withRemoteMcpEnvironment(
    {
      TESSLI_REMOTE_MCP_ENABLED: "true",
      TESSLI_REMOTE_MCP_ALLOWED_HOSTS: "*.tessli.test",
      TESSLI_REMOTE_MCP_ALLOWED_ORIGINS: "https://*.tessli.test",
    },
    async () => {
      assert.deepEqual(getRemoteMcpConfiguration(), {
        enabled: true,
        allowedHosts: [],
        allowedOrigins: [],
      });
      const response = await handleRemoteMcpRequest(requestFor({}));
      assert.equal(response.status, 503);
      assertSecurityHeaders(response);
    },
  );

  await withRemoteMcpEnvironment(
    {
      TESSLI_REMOTE_MCP_ENABLED: "true",
      TESSLI_REMOTE_MCP_ALLOWED_HOSTS: "mcp.tessli.test,not a host",
      TESSLI_REMOTE_MCP_ALLOWED_ORIGINS:
        "https://app.tessli.test,not-an-origin",
    },
    async () => {
      assert.deepEqual(getRemoteMcpConfiguration(), {
        enabled: true,
        allowedHosts: [],
        allowedOrigins: [],
      });
      const response = await handleRemoteMcpRequest(requestFor({}));
      assert.equal(response.status, 503);
      assertSecurityHeaders(response);
    },
  );

  await withRemoteMcpEnvironment(enabledEnvironment, async () => {
    for (const headers of [
      { host: "untrusted.tessli.test" },
      { host: "mcp.tessli.test", origin: "https://untrusted.tessli.test" },
      { host: "mcp.tessli.test", origin: "notaurl" },
    ]) {
      const response = await handleRemoteMcpRequest(
        requestFor({}, { headers }),
      );
      assert.equal(response.status, 403);
      assertSecurityHeaders(response);
    }

    for (const headers of [
      {
        origin: "https://app.tessli.test",
        "content-type": "application/json",
        "content-length": "2",
      },
      {
        host: "mcp.tessli.test",
        "content-type": "application/json",
        "content-length": "2",
      },
    ]) {
      const response = await handleRemoteMcpRequest(
        new Request("https://mcp.tessli.test/api/mcp", {
          method: "POST",
          headers,
          body: "{}",
        }),
      );
      assert.equal(response.status, 403);
      assertSecurityHeaders(response);
    }
  });
});

test("remote MCP bounds method, body, and rate state before transport", async () => {
  await withRemoteMcpEnvironment(enabledEnvironment, async () => {
    const noLength = new Request("https://mcp.tessli.test/api/mcp", {
      method: "POST",
      headers: {
        host: "mcp.tessli.test",
        origin: "https://app.tessli.test",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal((await handleRemoteMcpRequest(noLength)).status, 411);

    const malformed = await handleRemoteMcpRequest(requestFor("not-json"));
    assert.equal(malformed.status, 400);

    const oversized = "x".repeat(REMOTE_MCP_MAX_BODY_BYTES + 1);
    const tooLarge = await handleRemoteMcpRequest(requestFor(oversized));
    assert.equal(tooLarge.status, 413);

    const method = await handleRemoteMcpRequest(
      requestFor({}, { method: "PUT" }),
    );
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "POST, OPTIONS");

    assert.ok(REMOTE_MCP_RATE_LIMIT > 0);
    assert.ok(REMOTE_MCP_RATE_WINDOW_MS > 0);
    assert.ok(REMOTE_MCP_MAX_RATE_KEYS > 0);

    const rateHeaders = { "x-forwarded-for": "203.0.113.21" };
    for (
      let requestCount = 0;
      requestCount < REMOTE_MCP_RATE_LIMIT;
      requestCount += 1
    ) {
      const bounded = await handleRemoteMcpRequest(
        requestFor("not-json", { headers: rateHeaders }),
      );
      assert.equal(bounded.status, 400);
    }
    const rateLimited = await handleRemoteMcpRequest(
      requestFor("not-json", { headers: rateHeaders }),
    );
    assert.equal(rateLimited.status, 429);
    assert.ok(Number(rateLimited.headers.get("retry-after")) > 0);
  });
});

test("remote MCP exposes only the five existing read-only tools over the SDK HTTP transport", async () => {
  await withRemoteMcpEnvironment(enabledEnvironment, async () => {
    const response = await handleRemoteMcpRequest(
      requestFor({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    );

    assert.equal(response.status, 200);
    assertSecurityHeaders(response);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://app.tessli.test",
    );
    const payload = await response.json();
    assert.deepEqual(
      payload.result.tools.map((tool) => tool.name),
      [...TESSLI_MCP_TOOL_NAMES],
    );
    assert.ok(
      payload.result.tools.every(
        (tool) =>
          tool.annotations?.readOnlyHint === true &&
          tool.annotations?.destructiveHint === false &&
          tool.annotations?.openWorldHint === false,
      ),
    );
  });
});

test("remote MCP route stays a public-data forwarding boundary without provider or Board access", async () => {
  const [routeSource, transportSource, nativeToolSource] = await Promise.all([
    readFile(new URL("../app/api/mcp/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/mcp-http.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/mcp-native-tools.ts", import.meta.url), "utf8"),
  ]);
  const source = `${routeSource}\n${transportSource}\n${nativeToolSource}`;

  assert.match(routeSource, /handleRemoteMcpRequest/);
  assert.match(transportSource, /WebStandardStreamableHTTPServerTransport/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /provider token|service[- ]role|authorization/i);
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|indexedDB|boards-store|board-store/i,
  );
  assert.doesNotMatch(source, /https?:\/\/\s*\$?\{/i);
  assert.doesNotMatch(
    transportSource,
    /console\.(?:log|info|warn|error)|cache\.(?:set|put)|writeFile/,
  );
});
