import type { Category } from '../lib/data/categories';

// Issue #52: owner-approved mascot artwork; retain existing route mappings.
// The original mapping of home inspection to งานระบบ is retained for review.
const CATEGORY_CARDS: { label: string; slug: string; icon: string }[] = [
  { label: 'สร้างบ้าน', slug: 'สร้างบ้าน', icon: '/icons/categories/v2/home-building.webp' },
  { label: 'รีโนเวท/ต่อเติม', slug: 'รีโนเวท', icon: '/icons/categories/v2/renovation-extension.webp' },
  { label: 'โครงสร้างเหล็ก', slug: 'โครงสร้าง', icon: '/icons/categories/v2/steel-structure.webp' },
  { label: 'ไฟฟ้า', slug: 'ไฟฟ้า', icon: '/icons/categories/v2/electrical.webp' },
  { label: 'ประปา', slug: 'ประปา', icon: '/icons/categories/v2/plumbing.webp' },
  { label: 'รับตรวจบ้าน', slug: 'งานระบบ', icon: '/icons/categories/v2/home-inspection.webp' },
  { label: 'อื่นๆ', slug: 'อื่นๆ', icon: '/icons/categories/v2/other.webp' },
];

export function CategoryGrid({ categories }: { categories: Category[] }) {
  const realSlugs = new Set(categories.map((c) => c.slug));
  const cards = CATEGORY_CARDS.filter((card) => realSlugs.has(card.slug));
  return (
    <section id="categories" className="home-categories" aria-labelledby="category-title">
      <h2 id="category-title" className="sr-only">ประเภทงานยอดนิยม</h2>
      {cards.length === 0 ? <p className="home-empty">ยังไม่มีข้อมูลหมวดหมู่ในขณะนี้</p> : (
        <ul>{cards.map((card) => (
          <li key={card.slug}>
            <a href={`/search?category=${encodeURIComponent(card.slug)}`}>
              <span className="home-category-art"><img src={card.icon} alt="" width="512" height="512" /></span>
              <span className="home-category-label">{card.label}</span>
            </a>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
