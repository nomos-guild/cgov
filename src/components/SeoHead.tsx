import Head from "next/head";
import { useRouter } from "next/router";
import {
  SITE_URL,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  buildLocaleUrl,
  stripPath,
} from "@/lib/seo";

interface SeoHeadProps {
  title: string;
  description: string;
  /** Path-relative or absolute URL to the OG/Twitter image. Defaults to /nomos.png. */
  image?: string;
  /** og:type — "website" for landings, "article" for proposals/profiles. */
  type?: "website" | "article";
  /** Set true to emit a noindex robots meta (e.g. test pages). */
  noindex?: boolean;
}

const OG_LOCALE_MAP: Record<string, string> = {
  en: "en_US",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  pt: "pt_BR",
  ja: "ja_JP",
  zh: "zh_CN",
};

export function SeoHead({
  title,
  description,
  image = "/nomos.png",
  type = "website",
  noindex = false,
}: SeoHeadProps) {
  const router = useRouter();
  const locale = router.locale ?? DEFAULT_LOCALE;
  const path = stripPath(router.asPath || "/");
  const canonical = buildLocaleUrl(path, locale);
  const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;
  const ogLocale = OG_LOCALE_MAP[locale] ?? "en_US";

  return (
    <Head>
      <title key="title">{title}</title>
      <meta name="description" content={description} key="description" />
      <link rel="canonical" href={canonical} key="canonical" />

      {SUPPORTED_LOCALES.map((altLocale) => (
        <link
          key={`hreflang-${altLocale}`}
          rel="alternate"
          hrefLang={altLocale}
          href={buildLocaleUrl(path, altLocale)}
        />
      ))}
      <link
        key="hreflang-x-default"
        rel="alternate"
        hrefLang="x-default"
        href={buildLocaleUrl(path, DEFAULT_LOCALE)}
      />

      <meta property="og:title" content={title} key="og:title" />
      <meta
        property="og:description"
        content={description}
        key="og:description"
      />
      <meta property="og:type" content={type} key="og:type" />
      <meta property="og:url" content={canonical} key="og:url" />
      <meta property="og:image" content={imageUrl} key="og:image" />
      <meta property="og:site_name" content="CGOV" key="og:site_name" />
      <meta property="og:locale" content={ogLocale} key="og:locale" />

      <meta
        name="twitter:card"
        content="summary_large_image"
        key="twitter:card"
      />
      <meta name="twitter:title" content={title} key="twitter:title" />
      <meta
        name="twitter:description"
        content={description}
        key="twitter:description"
      />
      <meta name="twitter:image" content={imageUrl} key="twitter:image" />

      {noindex && (
        <meta name="robots" content="noindex,nofollow" key="robots" />
      )}
    </Head>
  );
}
