import type { Metadata } from 'next';
import { Hero } from '../src/components/Hero';
import { SearchEntry } from '../src/components/SearchEntry';
import { HeroTransition } from '../src/components/HeroTransition';
import { CategoryGrid } from '../src/components/CategoryGrid';
import { StatsBanner } from '../src/components/StatsBanner';
import { FeaturedContractors } from '../src/components/FeaturedContractors';
import { HowItWorks } from '../src/components/HowItWorks';
import { TrustSection } from '../src/components/TrustSection';
import { ContractorCta } from '../src/components/ContractorCta';
import { TestimonialsSection } from '../src/components/TestimonialsSection';
import { ArticlesSection } from '../src/components/ArticlesSection';
import { getCategories } from '../src/lib/data/categories';
import { getProvinces } from '../src/lib/data/provinces';
import { searchContractors } from '../src/lib/data/contractors';
import { getHomeStats } from '../src/lib/data/homeStats';
import { getFeaturedReviews } from '../src/lib/data/reviews';
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

// Phase 13 (Issue #11) fix: this page had NO revalidate/dynamic config,
// so Next.js's default fetch caching made it fully static — prerendered
// once at build time and then frozen. Confirmed with a real test: after
// building, inserting a brand-new category directly into Postgres and
// re-requesting `/` (no rebuild) did NOT show it. Categories/provinces
// (0002/0003's own comments: "Seeded once, rarely changes" / "~77...
// rarely changes") don't need per-request freshness — `force-dynamic`
// here would burn a DB round-trip on every visit to the highest-traffic
// page in the app for data that almost never changes. Time-based
// revalidation is the actual correct middle ground: fast cached HTML
// most of the time, bounded staleness (max 1 hour) instead of "frozen
// until the next deploy." Issue #42's new sections (stats/featured
// contractors/testimonials) are real, live-queried data too — the same
// bounded 1-hour staleness is an acceptable, deliberate tradeoff for a
// homepage rather than adding force-dynamic's per-request DB cost.
export const revalidate = 3600;

// Fetched once per request, server-side, and passed down — avoids any
// duplicate client-side fetching (see docs/PHASE4-HOME-PAGE-REPORT.md
// "Performance").
export default async function HomePage() {
  const [categories, provinces, featuredContractorsResult, homeStats, featuredReviews] = await Promise.all([
    getCategories(),
    getProvinces(),
    // Issue #42's "ช่างแนะนำ" section reuses the exact same real search
    // query /search itself uses (no filters, first page) — never a
    // second, separately-fabricated "featured" list.
    searchContractors({ page: 1 }),
    getHomeStats(),
    getFeaturedReviews(),
  ]);
  const siteUrl = getSiteUrl();
  const featuredContractors = featuredContractorsResult.ok ? featuredContractorsResult.results : [];

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
      <HeroTransition />
      <CategoryGrid categories={categories} />
      <StatsBanner
        stats={homeStats}
        approvedContractorCount={featuredContractorsResult.ok ? featuredContractorsResult.totalCount : 0}
      />
      <FeaturedContractors contractors={featuredContractors} />
      <HowItWorks />
      <TrustSection />
      <ContractorCta />
      <TestimonialsSection reviews={featuredReviews} />
      <ArticlesSection />
    </>
  );
}
