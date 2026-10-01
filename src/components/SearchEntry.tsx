import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';

/** Native GET form: preserve the existing /search query contract and no-JS use. */
export function SearchEntry({ categories, provinces }: { categories: Category[]; provinces: Province[] }) {
  return (
    <div id="search" className="home-search">
      <h2 className="sr-only">เริ่มค้นหาผู้รับเหมา</h2>
      <form action="/search" method="get">
        <div className="home-search-field">
          <label htmlFor="search-province" className="sr-only">จังหวัด</label>
          <select id="search-province" name="province" defaultValue="">
            <option value="">เลือกจังหวัด</option>
            {provinces.map((p) => <option key={p.id} value={p.slug}>{p.name_th}</option>)}
          </select>
        </div>
        <div className="home-search-field">
          <label htmlFor="search-category" className="sr-only">ประเภทงาน</label>
          <select id="search-category" name="category" defaultValue="">
            <option value="">ประเภทงาน</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name_th}</option>)}
          </select>
        </div>
        <div className="home-search-field">
          <label htmlFor="search-q" className="sr-only">คำค้นหา (ไม่บังคับ)</label>
          <input id="search-q" name="q" type="text" placeholder="เช่น ต่อเติมครัว" />
        </div>
        <button type="submit">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" /></svg>
          ค้นหาช่าง
        </button>
      </form>
    </div>
  );
}
