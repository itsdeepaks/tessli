import { isIP } from "node:net";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTessliMcpServer } from "../mcp/server.ts";

export const REMOTE_MCP_MAX_BODY_BYTES = 64 * 1024;
export const REMOTE_MCP_RATE_LIMIT = 60;
export const REMOTE_MCP_RATE_WINDOW_MS = 60_000;
export const REMOTE_MCP_MAX_RATE_KEYS = 2_000;

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
} as const;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export type RemoteMcpConfiguration = Readonly<{
  enabled: boolean;
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
}>;

function getExactEnvList(value: string | undefined): readonly string[] {
  if (!value) return [];

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.some((entry) => entry.includes("*"))) return [];

  return [...new Set(entries)];
}

function isValidHost(value: string): boolean {
  return /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(value);
}

function isValidOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && isLoopback)) &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export function getRemoteMcpConfiguration(): RemoteMcpConfiguration {
  const enabled = process.env.TESSLI_REMOTE_MCP_ENABLED === "true";
  const allowedHosts = getExactEnvList(
    process.env.TESSLI_REMOTE_MCP_ALLOWED_HOSTS,
  );
  const allowedOrigins = getExactEnvList(
    process.env.TESSLI_REMOTE_MCP_ALLOWED_ORIGINS,
  );

  return {
    enabled,
    // Treat a partially malformed allowlist as invalid instead of silently
    // dropping entries and enabling a narrower, surprising boundary.
    allowedHosts:
      allowedHosts.length > 0 && allowedHosts.every(isValidHost)
        ? allowedHosts.map((host) => host.toLowerCase())
        : [],
    allowedOrigins:
      allowedOrigins.length > 0 && allowedOrigins.every(isValidOrigin)
        ? allowedOrigins
        : [],
  };
}

function hasCompleteAllowlist(configuration: RemoteMcpConfiguration): boolean {
  return (
    configuration.allowedHosts.length > 0 &&
    configuration.allowedOrigins.length > 0
  );
}

function securityResponse(
  status: number,
  origin?: string,
  init: ResponseInit = {},
): Response {
  return applyResponseHeaders(new Response(null, { ...init, status }), origin);
}

function applyResponseHeaders(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Expose-Headers", "Mcp-Protocol-Version");
    headers.append("Vary", "Origin");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getRateLimitKey(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  // This is a best-effort key only. A production proxy must replace this
  // header with the peer address; the in-memory guard is not an auth boundary.
  if (forwarded && isIP(forwarded) !== 0) return `ip:${forwarded}`;

  return "anonymous";
}

function pruneExpiredRateBuckets(now: number): void {
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}

function consumeRateLimit(request: Request): number | undefined {
  const now = Date.now();
  pruneExpiredRateBuckets(now);

  let key = getRateLimitKey(request);
  let bucket = rateBuckets.get(key);

  if (!bucket && rateBuckets.size >= REMOTE_MCP_MAX_RATE_KEYS) {
    key = "overflow";
    bucket = rateBuckets.get(key);
  }

  if (!bucket) {
    bucket = { count: 0, resetAt: now + REMOTE_MCP_RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count <= REMOTE_MCP_RATE_LIMIT) return undefined;

  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}

function getDeclaredContentLength(request: Request): number | undefined {
  const rawContentLength = request.headers.get("content-length");
  if (!rawContentLength || !/^\d+$/.test(rawContentLength)) return undefined;

  const contentLength = Number(rawContentLength);
  return Number.isSafeInteger(contentLength) ? contentLength : undefined;
}

async function parseBoundedJsonRequest(
  request: Request,
): Promise<{ body: unknown } | { response: Response }> {
  const contentLength = getDeclaredContentLength(request);
  if (contentLength === undefined) {
    return { response: securityResponse(411) };
  }

  if (contentLength > REMOTE_MCP_MAX_BODY_BYTES) {
    return { response: securityResponse(413) };
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > REMOTE_MCP_MAX_BODY_BYTES) {
    return { response: securityResponse(413) };
  }

  try {
    return { body: JSON.parse(new TextDecoder().decode(body)) as unknown };
  } catch {
    return { response: securityResponse(400) };
  }
}

function hasBody(
  parsed: { body: unknown } | { response: Response },
): parsed is {
  body: unknown;
} {
  return "body" in parsed;
}

function hasAllowedRequestHeaders(
  request: Request,
  configuration: RemoteMcpConfiguration,
): string | undefined {
  const host = request.headers.get("host")?.toLowerCase();
  if (!host || !configuration.allowedHosts.includes(host)) return undefined;

  const origin = request.headers.get("origin");
  if (!origin || !configuration.allowedOrigins.includes(origin))
    return undefined;

  return origin;
}

function methodNotAllowed(origin: string): Response {
  return securityResponse(405, origin, {
    headers: { Allow: "POST, OPTIONS" },
  });
}

export async function handleRemoteMcpRequest(
  request: Request,
): Promise<Response> {
  const configuration = getRemoteMcpConfiguration();
  if (!configuration.enabled) return securityResponse(404);

  if (!hasCompleteAllowlist(configuration)) return securityResponse(503);

  const origin = hasAllowedRequestHeaders(request, configuration);
  if (!origin) return securityResponse(403);

  if (request.method === "OPTIONS") {
    return securityResponse(204, origin, {
      headers: {
        Allow: "POST, OPTIONS",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
        "Access-Control-Max-Age": "600",
      },
    });
  }

  if (request.method !== "POST") return methodNotAllowed(origin);

  const retryAfter = consumeRateLimit(request);
  if (retryAfter !== undefined) {
    return securityResponse(429, origin, {
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  const parsed = await parseBoundedJsonRequest(request);
  if (!hasBody(parsed)) return applyResponseHeaders(parsed.response, origin);

  const server = createTessliMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return applyResponseHeaders(
      await transport.handleRequest(request, { parsedBody: parsed.body }),
      origin,
    );
  } finally {
    await server.close();
  }
}
