-- =====================================================================
-- 0023_category_icons.sql
-- Depends on: 0003_categories.sql
-- Data-only migration: populates categories.icon for Issue #42's
-- Categories Layer B asset insertion.
-- =====================================================================

-- Issue #42, Layer B (Categories) — CORRECTED per the Project Owner's
-- blocker comment on this migration's first version (commit 6aafb90):
-- that version reused the sheet's "ต่อเติมบ้าน" (home-addition) house
-- icon for สร้างบ้าน (a materially different service — building a new
-- house, not extending one) and approximated ถนน/งานระบบ/อื่นๆ from
-- icons whose own caption did not name them. The owner's explicit
-- instruction: accuracy outranks completeness for a production-data
-- change — an approximate icon is worse than a temporary placeholder.
--
-- This version applies a strict rule: a category's icon column is set
-- ONLY when the supplied 14-icon sheet (Issue #42 comment
-- #5557421867) has a card whose OWN baked-in caption names that exact
-- category (by its real name_th/name_en, not just a loosely related
-- concept). Every icon file was cropped from that sheet with Pillow
-- (icon graphic only, caption excluded) — no icon was redrawn,
-- regenerated, or AI-recreated.
--
-- Verified mapping table (production category -> sheet card used):
--   ต่อเติม (Extension)         -> sheet card captioned "ต่อเติมบ้าน"          -> /icons/categories/2.webp  -- EXACT
--   รีโนเวท (Renovation)        -> sheet card captioned "ซ่อมแซม / รีโนเวท"    -> /icons/categories/3.webp  -- EXACT
--   โครงสร้าง (Structural Work) -> sheet card captioned "งานโครงสร้าง"        -> /icons/categories/4.webp  -- EXACT
--   ไฟฟ้า (Electrical)          -> sheet card captioned "งานไฟฟ้า"           -> /icons/categories/5.webp  -- EXACT
--   ประปา (Plumbing)            -> sheet card captioned "งานประปา"           -> /icons/categories/6.webp  -- EXACT
--   หลังคา (Roofing)            -> sheet card captioned "งานหลังคา"          -> /icons/categories/7.webp  -- EXACT
--
-- NOT set — no sheet card's own caption names these, so no asset is
-- claimed for them (they stay NULL and fall back to CategoryGrid.tsx's
-- existing AssetPlaceholder slot, same as before this migration ever
-- ran, until a matching icon is supplied):
--   สร้างบ้าน (Home Building)  — MISSING. The sheet has a house icon,
--     but its own caption is "ต่อเติมบ้าน" (home ADDITION), a different
--     real service from building a new house from scratch.
--   ถนน (Road/Driveway)        — MISSING. No sheet card is captioned
--     for road/driveway/paving work.
--   งานระบบ (MEP Systems)      — MISSING. No sheet card is captioned
--     for building systems generally; the sheet's air-conditioning
--     card is one MEP component, not the category as a whole, and
--     ไฟฟ้า/ประปา (this schema's other MEP-adjacent categories) are
--     already separate.
--   อื่นๆ (Other)              — MISSING. The sheet's "ดูทั้งหมด" card
--     is a "view all" navigation concept, not "other/miscellaneous
--     work" as its own selectable category.
update public.categories set icon = case slug
  when 'ต่อเติม'    then '/icons/categories/2.webp'
  when 'รีโนเวท'    then '/icons/categories/3.webp'
  when 'โครงสร้าง'  then '/icons/categories/4.webp'
  when 'ไฟฟ้า'      then '/icons/categories/5.webp'
  when 'ประปา'      then '/icons/categories/6.webp'
  when 'หลังคา'     then '/icons/categories/7.webp'
  when 'สร้างบ้าน'  then null
  when 'ถนน'        then null
  when 'งานระบบ'    then null
  when 'อื่นๆ'       then null
  else icon
end
where slug in ('สร้างบ้าน', 'ต่อเติม', 'รีโนเวท', 'โครงสร้าง', 'ไฟฟ้า', 'ประปา', 'หลังคา', 'ถนน', 'งานระบบ', 'อื่นๆ');
