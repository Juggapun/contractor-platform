import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';

export function Hero({ categories, provinces }: { categories: Category[]; provinces: Province[] }) {
  return <section className="home-hero" aria-labelledby="home-title">
    <h1 id="home-title" className="sr-only">ศูนย์รวมผู้รับเหมาไทย</h1>
    <p className="sr-only">หาช่างดี สร้างชีวิต! ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง ช่างดีมีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า</p>
    <picture>
      <source media="(max-width: 767px)" srcSet="/home/banner-mobile.webp" width="1254" height="1254" />
      <img className="home-hero-image" src="/home/banner-desktop.webp" width="2106" height="747" alt="" fetchPriority="high" />
    </picture>
    <div className="home-hero-search"><SearchEntry categories={categories} provinces={provinces} /></div>
  </section>;
}
