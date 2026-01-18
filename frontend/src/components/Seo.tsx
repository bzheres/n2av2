import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

type SeoProps = {
  title: string;
  description: string;
  canonicalPath?: string; // e.g. "/pricing" (preferred)
  image?: string;         // absolute URL recommended
  noindex?: boolean;      // for /account, /workflow, etc.
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
};

const SITE_NAME = "N2A";
const SITE_ORIGIN = "https://n2a.com.au"; // ✅ change if needed
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og.png`;

function toAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export default function Seo({
  title,
  description,
  canonicalPath,
  image,
  noindex,
  jsonLd,
}: SeoProps) {
  const { pathname } = useLocation();

  const canonical = toAbsoluteUrl(canonicalPath ?? pathname);
  const ogImage = toAbsoluteUrl(image ?? DEFAULT_OG_IMAGE);

  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  const robots = noindex ? "noindex, nofollow" : "index, follow";

  const jsonLdArr = !jsonLd ? [] : Array.isArray(jsonLd) ? jsonLd : [jsonLd];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta name="robots" content={robots} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD */}
      {jsonLdArr.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
    </Helmet>
  );
}
