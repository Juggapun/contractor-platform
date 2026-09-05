import type { ContractorSummary } from '../lib/data/contractors';
import { ContractorCard } from './ContractorCard';

const FEATURED_COUNT = 5;

/**
 * Home Page "ช่างแนะนำ" (Issue #42) — reuses searchContractors()'s own
 * result (unfiltered, first page, business_name order — see
 * app/page.tsx) and the SAME ContractorCard component /search already
 * renders, rather than a second "featured contractor" query/card
 * implementation. Every field shown (image, rating, review count,
 * categories, link) is exactly what that RLS-scoped, real-data query
 * already returns — no separate fabricated "featured" flag or curated
 * list exists.
 *
 * Issue #42, Layer A final calibration — height budgeted to ~391px at
 * `lg:` (249/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment) via
 * trimmed outer spacing. `ContractorCard` itself is intentionally left
 * untouched here: it's shared with `/search` (out of this Home-Page
 * pass's scope), so its own internal padding/sizing isn't part of this
 * geometry calibration — only this section's own container/heading/
 * grid spacing is. Container width unified to the shared ~1173px
 * content-width token.
 */
export function FeaturedContractors({ contractors }: { contractors: ContractorSummary[] }) {
  const featured = contractors.slice(0, FEATURED_COUNT);

  return (
    <section className="bg-white lg:flex lg:min-h-[391px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-6 sm:px-[53px] lg:py-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-master-text lg:text-lg">ช่างแนะนำ</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600 lg:text-xs">
              ผู้รับเหมาคุณภาพที่ผ่านการตรวจสอบแล้ว
            </p>
          </div>
          <a href="/search" className="flex-shrink-0 text-sm font-semibold text-brand-600 hover:underline">
            ดูทั้งหมด →
          </a>
        </div>

        {/* Issue #42, Layer A: reference shows one horizontal desktop
            row — lg:grid-cols-5 matches FEATURED_COUNT exactly so up to
            5 real cards sit in a single row at desktop width. */}
        {featured.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีผู้รับเหมาที่ผ่านการอนุมัติในขณะนี้
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-[9px]">
            {featured.map((contractor) => (
              <li key={contractor.id}>
                <ContractorCard contractor={contractor} headingLevel="h3" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
