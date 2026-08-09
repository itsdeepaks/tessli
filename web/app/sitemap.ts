import type { MetadataRoute } from "next";

import { getPublishedCollections } from "@/lib/collections";
import { getAllSourceProfiles } from "@/lib/source-profiles";

function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const staticRoutes = [
    "",
    "/resources",
    "/collections",
    "/for-ai",
    "/llms.txt",
    "/about",
    "/curation",
    "/privacy",
    "/terms",
    "/content-policy",
  ];

  return [
    ...staticRoutes.map((route) => ({ url: `${origin}${route}` })),
    ...getPublishedCollections().flatMap((collection) => [
      { url: `${origin}/collections/${collection.slug}` },
      { url: `${origin}/collections/${collection.slug}/collection.json` },
      { url: `${origin}/collections/${collection.slug}/collection.md` },
    ]),
    ...getAllSourceProfiles().flatMap((profile) => [
      { url: `${origin}/resources/${profile.slug}` },
      { url: `${origin}/resources/${profile.slug}/profile.json` },
      { url: `${origin}/resources/${profile.slug}/profile.md` },
    ]),
  ];
}
