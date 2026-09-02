import { Hero } from '../src/components/Hero';
import { SearchEntry } from '../src/components/SearchEntry';
import { CategoryGrid } from '../src/components/CategoryGrid';
import { HowItWorks } from '../src/components/HowItWorks';
import { TrustSection } from '../src/components/TrustSection';
import { ContractorCta } from '../src/components/ContractorCta';
import { getCategories } from '../src/lib/data/categories';
import { getProvinces } from '../src/lib/data/provinces';

// Fetched once per request, server-side, and passed down — avoids any
// duplicate client-side fetching (see docs/PHASE4-HOME-PAGE-REPORT.md
// "Performance").
export default async function HomePage() {
  const [categories, provinces] = await Promise.all([getCategories(), getProvinces()]);

  return (
    <>
      <Hero />
      <SearchEntry categories={categories} provinces={provinces} />
      <CategoryGrid categories={categories} />
      <HowItWorks />
      <TrustSection />
      <ContractorCta />
    </>
  );
}
