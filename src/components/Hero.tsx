import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';

/** Issue #48 owner revision: keep decorative Thai lettering as approved artwork.
 * SVG viewports reuse the untouched master asset, excluding baked navigation and
 * categories. The search is a real GET form; mobile moves it below the artwork
 * instead of shrinking controls. sr-only text supplies an accessible equivalent.
 */
export function Hero({ categories, provinces }: { categories: Category[]; provinces: Province[] }) {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <h1 id="home-title" className="sr-only">ศูนย์รวมผู้รับเหมาไทย</h1>
      <p className="sr-only">หาช่างดี สร้างชีวิต! ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง ช่างดีมีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ</p>
      <div className="home-hero-art">
        <svg className="home-hero-desktop-art" viewBox="0 106 1536 546" width="1536" height="546" aria-hidden="true" focusable="false">
          <image href="/home/master-full.webp" width="1536" height="1024" />
        </svg>
        <svg className="home-hero-mobile-art" viewBox="0 106 1536 374" width="1536" height="374" aria-hidden="true" focusable="false">
          <image href="/home/master-full.webp" width="1536" height="1024" />
        </svg>
        <div className="home-hero-search"><SearchEntry categories={categories} provinces={provinces} /></div>
      </div>
      <svg className="home-hero-mobile-tagline" viewBox="485 578 570 70" width="570" height="70" aria-hidden="true" focusable="false">
        <image href="/home/master-full.webp" width="1536" height="1024" />
      </svg>
      <p className="sr-only">หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า</p>
    </section>
  );
}
