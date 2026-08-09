export const ACCESS_ROUTE_KINDS = [
  "browser",
  "documentation",
  "package-registry",
  "source-code",
  "api",
  "mcp",
  "cli",
  "plugin",
] as const;

export type AccessRouteKind = (typeof ACCESS_ROUTE_KINDS)[number];
export type AccessRouteAuth = "none" | "user" | "unknown";

export interface AccessRoute {
  kind: AccessRouteKind;
  url?: string;
  preferred: boolean;
  auth: AccessRouteAuth;
  agentAction: string;
}

type SourceIdentity = Readonly<{ id: string; url: string }>;

const route = (
  kind: AccessRouteKind,
  preferred: boolean,
  auth: AccessRouteAuth,
  agentAction: string,
  url?: string,
): AccessRoute => ({
  kind,
  preferred,
  auth,
  agentAction,
  ...(url ? { url } : {}),
});

/**
 * V3.2 is intentionally a bounded pilot. These source IDs and routes are
 * derived only from the existing intelligence profiles and their evidence.
 */
export const ACCESS_ROUTE_PILOT_BY_SOURCE_ID: Readonly<
  Record<string, readonly AccessRoute[]>
> = Object.freeze({
  "resource-c6ead4379d56": [
    route(
      "browser",
      true,
      "unknown",
      "Open the canonical provider URL to inspect landing and section references.",
    ),
    route(
      "mcp",
      false,
      "user",
      "Connect a user-configured MCP client to the recorded Landingfolio endpoint.",
      "https://mcp.landingfolio.com/mcp",
    ),
  ],
  "resource-52bddd200880": [
    route(
      "browser",
      true,
      "unknown",
      "Open the canonical provider URL to inspect recorded app-flow references.",
    ),
    route(
      "mcp",
      false,
      "user",
      "Connect a user-configured MCP client to the recorded Mobbin endpoint.",
      "https://api.mobbin.com/mcp",
    ),
  ],
  "resource-75ecf91b7063": [
    route(
      "documentation",
      true,
      "unknown",
      "Read the official Google Fonts documentation before selecting a family.",
      "https://developers.google.com/fonts",
    ),
    route(
      "api",
      false,
      "user",
      "Call the recorded Developer API with a user-owned API key.",
      "https://www.googleapis.com/webfonts/v1/webfonts",
    ),
  ],
  "resource-affc29967a7c": [
    route(
      "cli",
      true,
      "unknown",
      "Use the documented CLI workflow in the target project.",
    ),
    route(
      "mcp",
      false,
      "none",
      "Connect a local MCP client to the documented shadcn registry integration.",
      "https://ui.shadcn.com/docs/mcp",
    ),
  ],
  "resource-374543d4f72b": [
    route(
      "documentation",
      true,
      "unknown",
      "Read the official Motion documentation before implementing animation.",
      "https://motion.dev",
    ),
    route(
      "package-registry",
      false,
      "unknown",
      "Use the recorded npm-package distribution for project installation.",
    ),
    route(
      "source-code",
      false,
      "unknown",
      "Review the recorded source-code integration before depending on implementation details.",
    ),
  ],
  "resource-e5c348f9190f": [
    route(
      "documentation",
      true,
      "unknown",
      "Read the official Three.js documentation and examples before building a scene.",
      "https://threejs.org",
    ),
    route(
      "package-registry",
      false,
      "unknown",
      "Use the recorded npm-package distribution for project installation.",
    ),
    route(
      "source-code",
      false,
      "unknown",
      "Review the recorded source-code integration before depending on implementation details.",
    ),
  ],
  "resource-01db82f90e23": [
    route(
      "documentation",
      true,
      "unknown",
      "Read the official Radix introduction and accessibility documentation before composing primitives.",
      "https://www.radix-ui.com/primitives/docs/overview/introduction",
    ),
    route(
      "package-registry",
      false,
      "unknown",
      "Use the recorded npm-package distribution for project installation.",
    ),
    route(
      "source-code",
      false,
      "unknown",
      "Review the recorded source-code integration before depending on implementation details.",
    ),
  ],
  "resource-9ab2847bb0d5": [
    route(
      "source-code",
      true,
      "unknown",
      "Review the recorded AutoAnimate repository and its installation guidance.",
      "https://github.com/formkit/auto-animate",
    ),
    route(
      "package-registry",
      false,
      "unknown",
      "Use the recorded npm-package distribution for project installation.",
    ),
  ],
  "resource-28acba4a9d55": [
    route(
      "cli",
      true,
      "unknown",
      "Use the documented CLI workflow in the target project.",
    ),
    route(
      "mcp",
      false,
      "none",
      "Connect an MCP client to the recorded 21st.dev endpoint.",
      "https://21st.dev/mcp",
    ),
  ],
  "resource-35c3f2fef142": [
    route(
      "browser",
      true,
      "user",
      "Open the canonical provider URL with an eligible Adobe account and plan.",
    ),
    route(
      "plugin",
      false,
      "user",
      "Use the recorded Creative Cloud integration within an eligible Adobe account.",
    ),
  ],
});

export const ACCESS_ROUTE_PILOT_SOURCE_IDS = Object.freeze(
  Object.keys(ACCESS_ROUTE_PILOT_BY_SOURCE_ID),
);

const FALLBACK_ACTION =
  "Open the canonical provider URL; sign-in and other access requirements are not recorded.";

export function getCanonicalAccessRoutes(
  source: SourceIdentity,
): readonly AccessRoute[] {
  const recorded = ACCESS_ROUTE_PILOT_BY_SOURCE_ID[source.id];
  if (!recorded) {
    return [route("browser", true, "unknown", FALLBACK_ACTION, source.url)];
  }

  return recorded.map((item) =>
    item.kind === "browser" && !item.url ? { ...item, url: source.url } : item,
  );
}
