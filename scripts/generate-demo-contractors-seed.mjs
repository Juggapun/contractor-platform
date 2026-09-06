#!/usr/bin/env node
/**
 * Issue #43 — QA/Demo Data: Seed 76 Synthetic Contractors Nationwide.
 *
 * Generates:
 *   1. 76 profile images + 380 portfolio images (5/contractor) as safe,
 *      synthetic SVG->WebP renders (gradient + shape + label; no real
 *      people, no third-party photos) under public/demo/qa43/.
 *   2. A single idempotent SQL migration
 *      (supabase/migrations/0024_demo_contractors_qa43_seed.sql) that
 *      inserts 76 demo auth.users + profiles + contractors (one per
 *      covered province, 76 of Thailand's 77 provinces — see the
 *      migration's own header for which is intentionally left out),
 *      contractor_categories, portfolio_images, and reviews (from a
 *      small pool of demo reviewer profiles).
 *
 * Determinism / idempotency: every UUID below is generated from a
 * seeded PRNG (not gen_random_uuid()), so re-running this script
 * regenerates byte-identical images and SQL. The migration itself uses
 * ON CONFLICT DO NOTHING on natural keys (email, slug, id) so applying
 * it twice is a no-op the second time.
 *
 * Demo marker: every synthetic account's email ends in
 * "@demo43.invalid" (".invalid" is the IANA/RFC 2606 reserved TLD for
 * exactly this kind of guaranteed-fake address) and every contractor
 * slug is prefixed "demo43-contractor-" — see this file's own
 * `REMOVAL PROCEDURE` comment block for the exact one-statement
 * cleanup this enables.
 *
 * This is a generator, not itself a migration — run it with
 * `node scripts/generate-demo-contractors-seed.mjs` whenever the demo
 * dataset needs regenerating; commit its two kinds of output (the
 * public/demo/qa43/ image files and the generated .sql migration).
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'public', 'demo', 'qa43');
const MIGRATION_PATH = join(ROOT, 'supabase', 'migrations', '0024_demo_contractors_qa43_seed.sql');

// ---------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic across runs, no dependency.
// ---------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(430043); // fixed seed: "43" + "0043" (Issue #43)

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pad3(n) {
  return String(n).padStart(3, '0');
}

// Deterministic fake-but-valid-looking UUID from the seeded PRNG.
function fakeUuid(rng) {
  const hex = () => Math.floor(rng() * 16).toString(16);
  const group = (n) => Array.from({ length: n }, hex).join('');
  return `${group(8)}-${group(4)}-4${group(3)}-a${group(3)}-${group(12)}`;
}

// ---------------------------------------------------------------------
// Reference data (mirrors supabase/migrations/0002_provinces.sql /
// 0003_categories.sql — kept in literal form here since this script
// runs standalone, before any DB connection, to build deterministic
// SQL; the migration itself still joins against the real tables by
// name/slug, so a mismatch here would fail loudly at apply time rather
// than silently inserting wrong data).
// ---------------------------------------------------------------------
const PROVINCES = [
  'กรุงเทพมหานคร', 'สมุทรปราการ', 'นนทบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา', 'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี',
  'ชัยนาท', 'สระบุรี', 'ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'นครนายก', 'สระแก้ว',
  'นครราชสีมา', 'บุรีรัมย์', 'สุรินทร์', 'ศรีสะเกษ', 'อุบลราชธานี', 'ยโสธร', 'ชัยภูมิ', 'อำนาจเจริญ',
  'หนองบัวลำภู', 'ขอนแก่น', 'อุดรธานี', 'เลย', 'หนองคาย', 'มหาสารคาม', 'ร้อยเอ็ด', 'กาฬสินธุ์', 'สกลนคร',
  'นครพนม', 'มุกดาหาร', 'เชียงใหม่', 'ลำพูน', 'ลำปาง', 'อุตรดิตถ์', 'แพร่', 'น่าน', 'พะเยา', 'เชียงราย',
  'แม่ฮ่องสอน', 'นครสวรรค์', 'อุทัยธานี', 'กำแพงเพชร', 'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'เพชรบูรณ์',
  'ราชบุรี', 'กาญจนบุรี', 'สุพรรณบุรี', 'นครปฐม', 'สมุทรสาคร', 'สมุทรสงคราม', 'เพชรบุรี', 'ประจวบคีรีขันธ์',
  'นครศรีธรรมราช', 'กระบี่', 'พังงา', 'ภูเก็ต', 'สุราษฎร์ธานี', 'ระนอง', 'ชุมพร', 'สงขลา', 'สตูล', 'ตรัง',
  'พัทลุง', 'ปัตตานี', 'ยะลา', 'นราธิวาส',
  // 'บึงกาฬ' (id 77) is INTENTIONALLY OMITTED — see migration header.
];
if (PROVINCES.length !== 76) {
  throw new Error(`Expected exactly 76 covered provinces, got ${PROVINCES.length}`);
}

const CATEGORIES = ['สร้างบ้าน', 'ต่อเติม', 'รีโนเวท', 'โครงสร้าง', 'ไฟฟ้า', 'ประปา', 'หลังคา', 'ถนน', 'งานระบบ', 'อื่นๆ'];
const CATEGORY_COLOR = {
  สร้างบ้าน: '#f2b705', ต่อเติม: '#e07a1f', รีโนเวท: '#c94f4f', โครงสร้าง: '#5b6b8c',
  ไฟฟ้า: '#e8c53a', ประปา: '#3a8ee8', หลังคา: '#7a4f2b', ถนน: '#4a4a4a',
  งานระบบ: '#3ab08e', อื่นๆ: '#8a5bd6',
};

const SURNAMES = [
  'ศรีสุข', 'จันทร์เพ็ญ', 'วงศ์ทอง', 'มั่นคง', 'รุ่งเรือง', 'สายชล', 'ไพศาล', 'บุญมี', 'เจริญพร', 'ทองดี',
  'แสงจันทร์', 'ภูวดล', 'สมบูรณ์', 'ปิยะวงศ์', 'ธนากร', 'ศิริพงษ์', 'วิไลลักษณ์', 'อารีย์', 'พูนสุข', 'เกียรติศักดิ์',
  'ชัยมงคล', 'นิลวรรณ', 'สุขสวัสดิ์', 'อินทร์แก้ว', 'ทับทิม', 'หอมจันทร์', 'กาญจนา', 'สิงห์โต', 'บัวขาว', 'แก้วมณี',
  'ประเสริฐ', 'มณีวงศ์', 'ธนพัฒน์', 'วัฒนกิจ', 'สุรินทร์', 'พงษ์ศักดิ์', 'ดำรงค์', 'ชูเกียรติ', 'อ่อนน้อม', 'พิพัฒน์',
];

const BUSINESS_TEMPLATES = [
  (s, c) => `${s} ${c}`,
  (s, c) => `ช่าง${s}`,
  (s, c) => `${s} เซอร์วิส`,
  (s, c) => `${s} การช่าง`,
  (s, c) => `หจก. ${s}${c}`,
  (s, c) => `${s} โฮมเซอร์วิส`,
];
const CATEGORY_SUFFIX = {
  สร้างบ้าน: 'ก่อสร้าง', ต่อเติม: 'ต่อเติมบ้าน', รีโนเวท: 'รีโนเวท', โครงสร้าง: 'วิศวกรรม',
  ไฟฟ้า: 'ไฟฟ้า', ประปา: 'ประปา', หลังคา: 'หลังคา', ถนน: 'ถนน-คอนกรีต',
  งานระบบ: 'ระบบอาคาร', อื่นๆ: 'ช่างทั่วไป',
};

const DESCRIPTION_TEMPLATES = [
  (cat, years) => `ทีมงานมืออาชีพด้าน${cat} รับงานทั่วประเทศ ประสบการณ์กว่า ${years} ปี ยินดีให้คำปรึกษาฟรี`,
  (cat, years) => `รับงาน${cat}ครบวงจร ราคายุติธรรม ทำงานตรงเวลา มีผลงานจริงให้ชมก่อนตัดสินใจ`,
  (cat, years) => `เชี่ยวชาญงาน${cat} ${years} ปี ทีมช่างมีประสบการณ์ รับประกันคุณภาพงานทุกโปรเจกต์`,
];

// Portfolio project-name templates per category (kept short, generic).
const PROJECT_TEMPLATES = {
  สร้างบ้าน: ['บ้านชั้นเดียวสไตล์โมเดิร์น', 'บ้านสองชั้นสไตล์คอนเทมโพรารี', 'บ้านทรงไทยประยุกต์'],
  ต่อเติม: ['ต่อเติมครัวหลังบ้าน', 'ต่อเติมห้องนั่งเล่น', 'ต่อเติมที่จอดรถ'],
  รีโนเวท: ['รีโนเวทห้องน้ำ', 'รีโนเวทห้องครัว', 'รีโนเวทบ้านทั้งหลัง'],
  โครงสร้าง: ['งานเสาเข็มและฐานราก', 'งานโครงสร้างอาคารพาณิชย์', 'งานเสริมโครงสร้างเหล็ก'],
  ไฟฟ้า: ['เดินสายไฟฟ้าใหม่ทั้งหลัง', 'ติดตั้งตู้ไฟและเบรกเกอร์', 'ติดตั้งไฟถนนโซลาร์เซลล์'],
  ประปา: ['วางระบบท่อประปาทั้งหลัง', 'ติดตั้งปั๊มน้ำและถังเก็บน้ำ', 'ซ่อมท่อรั่วซึมใต้บ้าน'],
  หลังคา: ['เปลี่ยนกระเบื้องหลังคาบ้าน', 'ซ่อมรอยรั่วหลังคา', 'ติดตั้งโครงหลังคาเหล็ก'],
  ถนน: ['เทถนนคอนกรีตในหมู่บ้าน', 'ซ่อมผิวถนนแอสฟัลต์', 'งานทางเข้าบ้านลาดยาง'],
  งานระบบ: ['ติดตั้งระบบปรับอากาศส่วนกลาง', 'วางระบบดับเพลิงอาคาร', 'ติดตั้งระบบระบายอากาศ'],
  อื่นๆ: ['งานทาสีภายนอกอาคาร', 'งานรั้วและประตูบ้าน', 'งานตกแต่งสวนหน้าบ้าน'],
};

// ---------------------------------------------------------------------
// Image generation — synthetic SVG -> WebP. No photos, no real people.
// ---------------------------------------------------------------------
async function renderImage(outPath, { width, height, bg, label, sublabel }) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg}" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <circle cx="${width * 0.82}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.18}" fill="#ffffff" opacity="0.12"/>
      <circle cx="${width * 0.12}" cy="${height * 0.82}" r="${Math.min(width, height) * 0.14}" fill="#ffffff" opacity="0.1"/>
      <text x="${width / 2}" y="${height / 2 - 6}" font-family="sans-serif" font-size="${Math.round(height * 0.09)}" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text>
      <text x="${width / 2}" y="${height / 2 + Math.round(height * 0.12)}" font-family="sans-serif" font-size="${Math.round(height * 0.055)}" fill="#ffffffcc" text-anchor="middle">${sublabel}</text>
      <text x="${width / 2}" y="${height - height * 0.06}" font-family="sans-serif" font-size="${Math.round(height * 0.05)}" fill="#ffffff99" text-anchor="middle">DEMO / QA ภาพจำลอง — ไม่ใช่ภาพจริง</text>
    </svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(outPath);
}

// ---------------------------------------------------------------------
// Build the 76 demo contractors.
// ---------------------------------------------------------------------
const contractors = [];
for (let i = 0; i < 76; i++) {
  const idx = i + 1;
  const province = PROVINCES[i];
  const category = CATEGORIES[i % CATEGORIES.length]; // round-robin -> guarantees full coverage
  const extraCategories =
    rand() < 0.4
      ? shuffle(rand, CATEGORIES.filter((c) => c !== category)).slice(0, rand() < 0.3 ? 2 : 1)
      : [];
  const surname = pick(rand, SURNAMES);
  const businessName = `[DEMO] ${pick(rand, BUSINESS_TEMPLATES)(surname, CATEGORY_SUFFIX[category])}`;
  const sparse = rand() < 0.35; // ~35% deliberately sparse profiles
  const years = sparse ? null : 1 + Math.floor(rand() * 24);
  const description = sparse ? null : pick(rand, DESCRIPTION_TEMPLATES)(category, years);
  const hasPhone = !sparse || rand() < 0.5;
  const hasLineId = !sparse && rand() < 0.6;
  const verified = rand() < 0.4;
  const featured = rand() < 0.2;
  const reviewCountTarget = rand() < 0.25 ? 0 : 1 + Math.floor(rand() * 11);

  contractors.push({
    idx,
    slug: `demo43-contractor-${pad3(idx)}`,
    userId: fakeUuid(rand),
    contractorId: fakeUuid(rand),
    email: `demo43-contractor-${pad3(idx)}@demo43.invalid`,
    ownerName: `[DEMO] เจ้าของกิจการ ${surname}`,
    businessName,
    province,
    categories: [category, ...extraCategories],
    years,
    description,
    phone: hasPhone ? `09${String(1000000 + idx).slice(-7)}` : null,
    lineId: hasLineId ? `demo43line${pad3(idx)}` : null,
    verified,
    featured,
    reviewCountTarget,
  });
}

// Sanity: every category must appear at least once (guaranteed by round-robin over 76 >> 10).
const coverage = new Set(contractors.flatMap((c) => c.categories));
if (coverage.size !== 10) throw new Error(`Category coverage incomplete: ${[...coverage].join(', ')}`);

// ---------------------------------------------------------------------
// Reviewer pool (separate demo customer profiles).
// ---------------------------------------------------------------------
const REVIEWER_POOL_SIZE = 25;
const reviewers = Array.from({ length: REVIEWER_POOL_SIZE }, (_, i) => ({
  idx: i + 1,
  userId: fakeUuid(rand),
  email: `demo43-reviewer-${pad3(i + 1)}@demo43.invalid`,
  name: `[DEMO] ผู้ใช้งานตัวอย่าง ${pad3(i + 1)}`,
}));

const REVIEW_COMMENTS = [
  'งานเรียบร้อยดี ตรงตามนัดหมาย แนะนำเลยครับ',
  'บริการดีมาก ราคาสมเหตุสมผล ทำงานสะอาดเรียบร้อย',
  'ทีมงานมืออาชีพ ให้คำแนะนำดี ผลงานตรงปก',
  'พอใจกับงานที่ได้ ติดต่อง่าย ตอบไว',
  'คุณภาพงานดี แต่ใช้เวลานานกว่ากำหนดเล็กน้อย',
  null,
];

// ---------------------------------------------------------------------
// Assign reviews (deterministic, no reviewer reviews the same contractor twice).
// ---------------------------------------------------------------------
const reviewsByContractor = new Map();
for (const c of contractors) {
  if (c.reviewCountTarget === 0) continue;
  const pool = shuffle(rand, reviewers).slice(0, c.reviewCountTarget);
  const list = pool.map((r) => ({
    reviewer: r,
    rating: rand() < 0.7 ? (rand() < 0.5 ? 5 : 4) : rand() < 0.7 ? 3 : rand() < 0.5 ? 2 : 1,
    comment: pick(rand, REVIEW_COMMENTS),
  }));
  reviewsByContractor.set(c.slug, list);
}

// ---------------------------------------------------------------------
// Render images.
// ---------------------------------------------------------------------
async function main() {
  mkdirSync(join(IMG_DIR, 'profiles'), { recursive: true });
  mkdirSync(join(IMG_DIR, 'portfolio'), { recursive: true });

  console.log('Rendering 76 profile images...');
  for (const c of contractors) {
    const outPath = join(IMG_DIR, 'profiles', `${c.slug}.webp`);
    await renderImage(outPath, {
      width: 400,
      height: 400,
      bg: CATEGORY_COLOR[c.categories[0]],
      label: c.businessName.replace('[DEMO] ', ''),
      sublabel: c.province,
    });
  }

  console.log('Rendering 380 portfolio images...');
  for (const c of contractors) {
    const projectNames = PROJECT_TEMPLATES[c.categories[0]];
    for (let n = 0; n < 5; n++) {
      const outPath = join(IMG_DIR, 'portfolio', `${c.slug}-${n + 1}.webp`);
      await renderImage(outPath, {
        width: 400,
        height: 300,
        bg: CATEGORY_COLOR[c.categories[(n + 1) % c.categories.length]],
        label: projectNames[n % projectNames.length],
        sublabel: `ผลงานที่ ${n + 1}`,
      });
    }
  }

  const totalPortfolio = contractors.length * 5;
  console.log(`Done: ${contractors.length} profile images, ${totalPortfolio} portfolio images.`);

  // ---------------------------------------------------------------------
  // Build the SQL migration.
  // ---------------------------------------------------------------------
  const esc = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

  const lines = [];
  lines.push(`-- =====================================================================`);
  lines.push(`-- 0024_demo_contractors_qa43_seed.sql`);
  lines.push(`-- Issue #43 — QA/Demo Data: 76 synthetic contractors nationwide.`);
  lines.push(`-- Generated by scripts/generate-demo-contractors-seed.mjs — do not hand-edit;`);
  lines.push(`-- regenerate via that script instead so the SQL and the image files under`);
  lines.push(`-- public/demo/qa43/ stay in sync.`);
  lines.push(`--`);
  lines.push(`-- Deliberately kept separate from migration 0023 (Issue #42 category icons)`);
  lines.push(`-- and from all Home UI work — this is QA/demo data only, never represented`);
  lines.push(`-- as real production contractors.`);
  lines.push(`--`);
  lines.push(`-- Coverage: 76 of Thailand's 77 provinces. บึงกาฬ (Bueng Kan, the newest`);
  lines.push(`-- province, established 2011) is the ONE province intentionally left`);
  lines.push(`-- uncovered, per the issue's own "do not create 77 records" rule.`);
  lines.push(`--`);
  lines.push(`-- Idempotent: every insert below is guarded by ON CONFLICT DO NOTHING on a`);
  lines.push(`-- natural key (email / slug / id), so re-running this file is a no-op.`);
  lines.push(`--`);
  lines.push(`-- REMOVAL PROCEDURE (safe, single statement — cascades through every demo`);
  lines.push(`-- row this migration creates: profiles, contractors, contractor_categories,`);
  lines.push(`-- portfolio_images, reviews):`);
  lines.push(`--   delete from auth.users where email like '%@demo43.invalid';`);
  lines.push(`-- Then remove the generated image files (not tracked by the DB):`);
  lines.push(`--   rm -rf public/demo/qa43`);
  lines.push(`--`);
  lines.push(`-- Trusted-context note: inserting into auth.users fires`);
  lines.push(`-- handle_new_user(), which auto-creates a public.profiles row with the`);
  lines.push(`-- default role ('customer') before this file's own profiles insert ever`);
  lines.push(`-- runs — so that insert uses ON CONFLICT ... DO UPDATE to correct role/`);
  lines.push(`-- full_name afterward. That UPDATE itself passes through`);
  lines.push(`-- trg_profiles_lock_role, which discards role changes outside a trusted`);
  lines.push(`-- context (public.is_trusted_context(): is_admin() or auth.role() =`);
  lines.push(`-- 'service_role') — hence the request.jwt.claims set below, the same`);
  lines.push(`-- technique supabase/local-dev/run-security-tests.mjs already uses to`);
  lines.push(`-- exercise specific Postgres roles. The whole file runs as one`);
  lines.push(`-- transaction so it is all-or-nothing.`);
  lines.push(`-- =====================================================================`);
  lines.push('');
  lines.push('begin;');
  lines.push(`set local request.jwt.claims = '{"role":"service_role"}';`);
  lines.push('');

  // auth.users + profiles for contractors
  lines.push('-- 76 demo contractor accounts (auth.users + profiles).');
  for (const c of contractors) {
    lines.push(
      `insert into auth.users (id, email, raw_user_meta_data) values (${esc(c.userId)}, ${esc(c.email)}, jsonb_build_object('demo', 'qa43', 'full_name', ${esc(c.ownerName)})) on conflict (email) do nothing;`
    );
  }
  lines.push('');
  for (const c of contractors) {
    lines.push(
      `insert into public.profiles (id, role, full_name) values (${esc(c.userId)}, 'contractor', ${esc(c.ownerName)}) on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;`
    );
  }
  lines.push('');

  // reviewer pool
  lines.push(`-- ${REVIEWER_POOL_SIZE} demo reviewer accounts (auth.users + profiles), reused across contractors.`);
  for (const r of reviewers) {
    lines.push(
      `insert into auth.users (id, email, raw_user_meta_data) values (${esc(r.userId)}, ${esc(r.email)}, jsonb_build_object('demo', 'qa43', 'full_name', ${esc(r.name)})) on conflict (email) do nothing;`
    );
  }
  lines.push('');
  for (const r of reviewers) {
    lines.push(
      `insert into public.profiles (id, role, full_name) values (${esc(r.userId)}, 'customer', ${esc(r.name)}) on conflict (id) do update set full_name = excluded.full_name;`
    );
  }
  lines.push('');

  // contractors
  lines.push('-- 76 demo contractors, one per covered province.');
  for (const c of contractors) {
    const featuredUntil = c.featured ? `now() + interval '30 days'` : 'null';
    lines.push(
      `insert into public.contractors (id, user_id, business_name, slug, description, phone, line_id, province_id, district_id, years_experience, profile_image_url, status, verification_status, featured_until)\n` +
        `  select ${esc(c.contractorId)}, ${esc(c.userId)}, ${esc(c.businessName)}, ${esc(c.slug)}, ${esc(c.description)}, ${esc(c.phone)}, ${esc(c.lineId)}, p.id, (select d.id from public.districts d where d.province_id = p.id order by random() limit 1), ${c.years ?? 'null'}, ${esc(`/demo/qa43/profiles/${c.slug}.webp`)}, 'approved', ${esc(c.verified ? 'verified' : 'unverified')}, ${featuredUntil}\n` +
        `  from public.provinces p where p.name_th = ${esc(c.province)}\n` +
        `  on conflict (slug) do nothing;`
    );
  }
  lines.push('');

  // contractor_categories
  lines.push('-- Category assignments (round-robin guarantees all 10 categories are represented).');
  for (const c of contractors) {
    for (const cat of c.categories) {
      lines.push(
        `insert into public.contractor_categories (contractor_id, category_id)\n` +
          `  select ${esc(c.contractorId)}, cat.id from public.categories cat where cat.name_th = ${esc(cat)}\n` +
          `  on conflict do nothing;`
      );
    }
  }
  lines.push('');

  // portfolio_images
  lines.push('-- 5 portfolio images per contractor = 380 total, synthetic WebP renders under public/demo/qa43/portfolio/.');
  for (const c of contractors) {
    const projectNames = PROJECT_TEMPLATES[c.categories[0]];
    for (let n = 0; n < 5; n++) {
      const path = `/demo/qa43/portfolio/${c.slug}-${n + 1}.webp`;
      const projectName = projectNames[n % projectNames.length];
      lines.push(
        `insert into public.portfolio_images (id, contractor_id, project_name, project_type, image_url, thumbnail_url, sort_order)\n` +
          `  values (${esc(fakeUuid(rand))}, ${esc(c.contractorId)}, ${esc(projectName)}, ${esc(c.categories[0])}, ${esc(path)}, ${esc(path)}, ${n})\n` +
          `  on conflict (id) do nothing;`
      );
    }
  }
  lines.push('');

  // reviews
  lines.push('-- Reviews from the demo reviewer pool (contractors.rating_avg/review_count auto-update via trigger).');
  for (const [slug, list] of reviewsByContractor.entries()) {
    const c = contractors.find((x) => x.slug === slug);
    for (const rv of list) {
      lines.push(
        `insert into public.reviews (contractor_id, reviewer_id, rating, comment)\n` +
          `  values (${esc(c.contractorId)}, ${esc(rv.reviewer.userId)}, ${rv.rating}, ${esc(rv.comment)})\n` +
          `  on conflict (contractor_id, reviewer_id) do nothing;`
      );
    }
  }
  lines.push('');
  lines.push('commit;');
  lines.push('');

  writeFileSync(MIGRATION_PATH, lines.join('\n') + '\n');
  console.log(`Wrote ${MIGRATION_PATH}`);

  // Summary for the calling script/report.
  const categoryCounts = {};
  for (const c of contractors) for (const cat of c.categories) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  console.log('Category distribution (primary + extra):', categoryCounts);
  console.log('Contractors with reviews:', reviewsByContractor.size, '/ 76');
  console.log('Featured contractors:', contractors.filter((c) => c.featured).length);
  console.log('Verified contractors:', contractors.filter((c) => c.verified).length);
  console.log('Sparse (no description/years):', contractors.filter((c) => c.description === null).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
