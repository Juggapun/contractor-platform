import type { Metadata } from 'next';
import { getCategories } from '../../src/lib/data/categories';
import { getProvinces } from '../../src/lib/data/provinces';
import { searchContractors, CONTRACTORS_PAGE_SIZE } from '../../src/lib/data/contractors';
import { parseSearchParams, type RawSearchParams } from '../../src/lib/search/params';
import { ContractorCard } from '../../src/components/ContractorCard';
import { SearchFilters } from '../../src/components/SearchFilters';
import { SearchPagination } from '../../src/components/SearchPagination';

export const metadata: Metadata = {
  title: 'ค้นหาผู้รับเหมา',
  description: 'ค้นหาและเปรียบเทียบผู้รับเหมาก่อสร้างตามประเภทงานและจังหวัด',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = await searchParams;
  const parsed = parseSearchParams(rawParams);

  const [categories, provinces, searchResult] = await Promise.all([
    getCategories(),
    getProvinces(),
    searchContractors(parsed),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ค้นหาผู้รับเหมา</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        เลือกประเภทงาน จังหวัด หรือค้นหาด้วยคำสำคัญ เพื่อค้นหาผู้รับเหมาที่เหมาะกับงานของคุณ
      </p>

      <div className="mt-6">
        <SearchFilters categories={categories} provinces={provinces} current={parsed} />
      </div>

      <div className="mt-8">
        {!searchResult.ok ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-[15px] leading-relaxed text-red-800"
          >
            เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง
            <p className="mt-1 text-sm text-red-700">({searchResult.message})</p>
          </div>
        ) : searchResult.results.length === 0 ? (
          <div
            role="status"
            className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center"
          >
            <p className="text-[15px] leading-relaxed text-slate-600">
              ไม่พบผู้รับเหมาที่ตรงกับเงื่อนไขที่เลือก ลองเปลี่ยนตัวกรองหรือล้างตัวกรองทั้งหมด
            </p>
            <a
              href="/search"
              className="mt-4 inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              ล้างตัวกรองทั้งหมด
            </a>
          </div>
        ) : (
          <>
            <p role="status" className="text-sm text-slate-600">
              พบ {searchResult.totalCount.toLocaleString('th-TH')} ผู้รับเหมา
              {searchResult.totalPages > 1
                ? ` — หน้า ${searchResult.page} จาก ${searchResult.totalPages}`
                : ''}
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {searchResult.results.map((contractor) => (
                <li key={contractor.id}>
                  <ContractorCard contractor={contractor} />
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <SearchPagination
                current={parsed}
                page={searchResult.page}
                totalPages={searchResult.totalPages}
              />
            </div>
          </>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">
        แสดงสูงสุด {CONTRACTORS_PAGE_SIZE} รายการต่อหน้า
      </p>
    </div>
  );
}
