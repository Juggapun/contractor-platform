import type { Metadata } from 'next';
import { Hero } from '../src/components/Hero';
import { SearchEntry } from '../src/components/SearchEntry';
import { CategoryGrid } from '../src/components/CategoryGrid';
import { HowItWorks } from '../src/components/HowItWorks';
import { TrustSection } from '../src/components/TrustSection';
import { ContractorCta } from '../src/components/ContractorCta';
import { getCategories } from '../src/lib/data/categories';
import { getProvinces } from '../src/lib/data/provinces';
import { getSiteUrl } from '../src/lib/env';
import { JsonLd } from '../src/components/JsonLd';

// title/description inherit the layout's own defaults (they already ARE
// the homepage's copy) — this only adds what's specific to being the
// canonical root: the canonical link itself and an explicit OG url
// (Phase 11, Issue #9's "generate canonical URLs for indexable public
// pages").
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

// Fetched once per request, server-side, and passed down — avoids any
// duplicate client-side fetching (see docs/PHASE4-HOME-PAGE-REPORT.md
// "Performance").
export default async function HomePage() {
  const [categories, provinces] = await Promise.all([getCategories(), getProvinces()]);
  const siteUrl = getSiteUrl();

  return (
    <>
      {/* WebSite structured data with a SearchAction — conservative and
          real: the site does have exactly this search feature
          (app/search/page.tsx), no fabricated capability described.
          Unlike the `metadata` export above, this raw JSON-LD is never
          resolved against metadataBase, so URLs here must be absolute. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'ศูนย์รวมผู้รับเหมาไทย',
          url: siteUrl,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${siteUrl}/search?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <Hero />
      <SearchEntry categories={categories} provinces={provinces} />
      <CategoryGrid categories={categories} />
      <HowItWorks />
      <TrustSection />
      <ContractorCta />
    </>
  );
}
