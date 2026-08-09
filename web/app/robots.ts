import type { MetadataRoute } from "next";

function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/u, "");

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction)
    return `https://${vercelProduction.replace(/\/$/u, "")}`;

  return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/auth",
        "/submit",
        "/suggest",
        "/saved",
        "/boards",
        "/lab/",
        "/proofs/",
      ],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
