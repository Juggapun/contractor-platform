import type { ContractorSummary } from '../lib/data/contractors';
import { ContractorCard } from './ContractorCard';

const FEATURED_COUNT = 4;

/**
 * Home Page "ช่างแนะนำ" (Issue #42) — reuses searchContractors()'s own
 * result (unfiltered, first page, business_name order — see
 * app/page.tsx) and the SAME ContractorCard component /search already
 * renders, rather than a second "featured contractor" query/card
 * implementation. Every field shown (image, rating, review count,
 * categories, link) is exactly what that RLS-scoped, real-data query
 * already returns — no separate fabricated "featured" flag or curated
 * list exists.
 */
export function FeaturedContractors({ contractors }: { contractors: ContractorSummary[] }) {
  const featured = contractors.slice(0, FEATURED_COUNT);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">ช่างแนะนำ</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
              ผู้รับเหมาคุณภาพที่ผ่านการตรวจสอบแล้ว
            </p>
          </div>
          <a href="/search" className="flex-shrink-0 text-sm font-semibold text-brand-600 hover:underline">
            ดูทั้งหมด →
          </a>
        </div>

        {featured.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีผู้รับเหมาที่ผ่านการอนุมัติในขณะนี้
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
