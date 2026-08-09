import {
  createPublicOptionsHeaders,
  createPublicRepresentationHeaders,
  createPublicSourceRepresentation,
  serializePublicJson,
  serializePublicSourceMarkdown,
} from "@/lib/public-representations.mjs";
import { getSimilarSourceProfiles } from "@/lib/similar-sources";
import { getAllSourceProfiles, getSourceProfile } from "@/lib/source-profiles";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

const representations = ["profile.json", "profile.md"] as const;

type RouteProps = Readonly<{
  params: Promise<{ slug: string; representation: string }>;
}>;

export function generateStaticParams() {
  return getAllSourceProfiles().flatMap((profile) =>
    representations.map((representation) => ({
      slug: profile.slug,
      representation,
    })),
  );
}

function notFoundResponse(representation: string) {
  const json = representation.endsWith(".json");
  return new Response(
    json
      ? `${JSON.stringify({ error: "Source representation not found." }, null, 2)}\n`
      : "# Source representation not found\n",
    {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": json
          ? "application/json; charset=utf-8"
          : "text/markdown; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

async function buildResponse({ params }: RouteProps, head = false) {
  const { slug, representation } = await params;
  if (
    !representations.includes(
      representation as (typeof representations)[number],
    )
  ) {
    return notFoundResponse(representation);
  }
  const profile = getSourceProfile(slug);
  if (!profile) return notFoundResponse(representation);
  const document = createPublicSourceRepresentation(
    profile,
    getSimilarSourceProfiles(profile, 2),
  );
  const format = representation.endsWith(".json") ? "json" : "markdown";
  const body =
    format === "json"
      ? serializePublicJson(document)
      : serializePublicSourceMarkdown(document);
  const extension = format === "json" ? "json" : "md";
  return new Response(head ? null : body, {
    status: 200,
    headers: createPublicRepresentationHeaders({
      format,
      filename: `tessli-${profile.slug}-profile.${extension}`,
      canonicalPath: document.canonicalPath,
      jsonPath: document.representations.json,
      markdownPath: document.representations.markdown,
    }),
  });
}

export async function GET(_request: Request, context: RouteProps) {
  return buildResponse(context);
}

export async function HEAD(_request: Request, context: RouteProps) {
  return buildResponse(context, true);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: createPublicOptionsHeaders(),
  });
}
