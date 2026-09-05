/**
 * Search Intelligence MVP (Issue #40) — category synonym dictionary.
 * Maps informal Thai phrases a real user is likely to type (e.g.
 * "ช่างไฟ") to this catalog's own actual `categories.name_th` value
 * ("ไฟฟ้า"). Every value here MUST be a real category name — this file
 * never invents a category, and `tests/searchSuggestion.test.ts`
 * asserts every value matches one of the 10 real seeded categories so a
 * future rename/removal in the catalog fails loudly here instead of
 * silently pointing a suggestion at nothing.
 *
 * Deliberately a plain object, not a database table: Issue #40 asks not
 * to change schema for this MVP, and a hand-curated list this size is
 * easy to extend right here as real search logs surface more gaps
 * (that's the "foundation to build on" the issue asks for) — no query,
 * no admin UI, no migration needed to add an entry.
 *
 * Kept intentionally conservative: only genuinely common, unambiguous
 * phrasings are listed. `อื่นๆ` (a catch-all "other" category) has none
 * at all — mapping arbitrary text to a catch-all is exactly the "vague
 * match to unrelated text" Issue #40 says not to do.
 */
export const CATEGORY_SYNONYMS: Record<string, string> = {
  // ไฟฟ้า (Electrical)
  ช่างไฟ: 'ไฟฟ้า',
  ช่างไฟฟ้า: 'ไฟฟ้า',
  ไฟฟ้าบ้าน: 'ไฟฟ้า',
  ซ่อมไฟ: 'ไฟฟ้า',

  // ประปา (Plumbing)
  ช่างประปา: 'ประปา',
  ช่างท่อ: 'ประปา',
  ท่อน้ำ: 'ประปา',
  ท่อประปา: 'ประปา',
  ซ่อมท่อ: 'ประปา',

  // หลังคา (Roofing)
  ช่างหลังคา: 'หลังคา',
  ซ่อมหลังคา: 'หลังคา',
  หลังคารั่ว: 'หลังคา',
  มุงหลังคา: 'หลังคา',

  // ต่อเติม (Extension)
  ช่างต่อเติม: 'ต่อเติม',
  ต่อเติมบ้าน: 'ต่อเติม',
  ต่อเติมห้อง: 'ต่อเติม',

  // สร้างบ้าน (Home Building)
  รับสร้างบ้าน: 'สร้างบ้าน',
  สร้างบ้านใหม่: 'สร้างบ้าน',
  ช่างสร้างบ้าน: 'สร้างบ้าน',

  // รีโนเวท (Renovation)
  รีโนเวทบ้าน: 'รีโนเวท',
  ปรับปรุงบ้าน: 'รีโนเวท',
  ปรับปรุง: 'รีโนเวท',

  // โครงสร้าง (Structural Work)
  งานโครงสร้าง: 'โครงสร้าง',
  ช่างโครงสร้าง: 'โครงสร้าง',

  // ถนน (Road/Driveway)
  ช่างถนน: 'ถนน',
  ทำถนน: 'ถนน',
  ลาดยาง: 'ถนน',

  // งานระบบ (MEP Systems)
  ระบบปรับอากาศ: 'งานระบบ',
  งานระบบอาคาร: 'งานระบบ',
};
