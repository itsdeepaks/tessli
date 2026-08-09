export const dynamic = "force-static";
export const revalidate = false;

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

function llmsDocument() {
  return `# Tessli

> Tessli is a human-curated, AI-native design-source router.

Tessli helps people and coding agents describe a design or frontend task, find a small relevant set of sources, understand why each source fits, and choose an appropriate access route. It is research guidance, not a provider mirror or an autonomous taste engine.

## Canonical human routes

- /resources — task-first source browser.
- /resources/[slug] — source guide.
- /collections — guided research paths.
- /collections/[slug] — ordered research checklist.
- /for-ai — current human-to-agent workflow and local setup.

## Public machine-readable forms

Source guides have compact JSON and Markdown representations:

- /resources/[slug]/profile.json
- /resources/[slug]/profile.md

Published Collections have compact JSON and Markdown representations:

- /collections/[slug]/collection.json
- /collections/[slug]/collection.md

Existing examples:

- /resources/landingfolio/profile.json
- /resources/landingfolio/profile.md
- /collections/saas-landing-pages/collection.json
- /collections/saas-landing-pages/collection.md

## Local MCP only

Tessli's MCP server is a local, read-only, repository-backed stdio process. There is no hosted or remote MCP endpoint. It uses public repository data and does not write Tessli state.

## Boundaries

- No Board or Saved data is public: both stay browser-local and private.
- Tessli has no bulk catalogue API or bulk public-data endpoint.
- No provider crawl, proxy, or credential handling: Tessli does not bypass provider access controls.
- Recheck provider access, pricing, licensing, terms, availability, and other time-sensitive details at the provider.
- No universal rankings or universal design-taste claims.
`;
}

function discoveryHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": CACHE_CONTROL,
    "Content-Type": "text/plain; charset=utf-8",
    "Cross-Origin-Resource-Policy": "cross-origin",
    Link: `</llms.txt>; rel="canonical"; type="text/plain"`,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "index, follow",
  };
}

function optionsHeaders() {
  return {
    Allow: "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function response(head = false) {
  return new Response(head ? null : llmsDocument(), {
    status: 200,
    headers: discoveryHeaders(),
  });
}

export function GET() {
  return response();
}

export function HEAD() {
  return response(true);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: optionsHeaders(),
  });
}
