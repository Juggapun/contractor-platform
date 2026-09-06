-- =====================================================================
-- 0023_category_icons.sql
-- Depends on: 0003_categories.sql
-- Data-only migration: populates categories.icon for Issue #42's
-- Categories Layer B asset insertion.
-- =====================================================================

-- Issue #42, Layer B (Categories) — history of this file:
--   commit 6aafb90 (v1): reused the sheet's "ต่อเติมบ้าน" house icon for
--     สร้างบ้าน and approximated ถนน/งานระบบ/อื่นๆ from icons whose own
--     caption did not name them. Rejected by the Owner's blocker comment
--     (#5557507447) — accuracy outranks completeness for production data.
--   commit e578bb2 (v2): corrected to a strict rule — a category's icon
--     is set ONLY when a supplied sheet has a card whose OWN baked-in
--     caption names that exact category. 6/10 categories matched the
--     original 14-icon sheet (#5557421867); the other 4 (สร้างบ้าน, ถนน,
--     งานระบบ, อื่นๆ) had no qualifying asset and were left NULL, and
--     reported as missing rather than guessed (per the Owner's comment).
--   this version (v3): the Owner supplied a new 4-icon sheet in comment
--     #5557762471, explicitly captioned one-to-one with the 4 previously-
--     missing categories and their target asset paths (comment
--     #5557767814 — "EXECUTION — Categories Layer B: ใช้ไอคอน 4 หมวดที่
--     แนบมา"). All 4 now resolve to real, cropped assets. The 6 EXACT
--     mappings from v2 are unchanged.
--
-- Every icon file (all 10) was cropped from its source sheet with Pillow
-- (icon graphic only, caption/asset-path label text excluded, verified
-- pixel-by-pixel for stray artifacts) — no icon was redrawn, regenerated,
-- or AI-recreated.
--
-- Verified mapping table (production category -> sheet card used):
--   สร้างบ้าน (Home Building)    -> new 4-icon sheet, card captioned "สร้างบ้าน"     -> /icons/categories/1.webp   -- EXACT
--   ต่อเติม (Extension)         -> original sheet, card captioned "ต่อเติมบ้าน"      -> /icons/categories/2.webp   -- EXACT
--   รีโนเวท (Renovation)        -> original sheet, card captioned "ซ่อมแซม / รีโนเวท" -> /icons/categories/3.webp   -- EXACT
--   โครงสร้าง (Structural Work) -> original sheet, card captioned "งานโครงสร้าง"     -> /icons/categories/4.webp   -- EXACT
--   ไฟฟ้า (Electrical)          -> original sheet, card captioned "งานไฟฟ้า"        -> /icons/categories/5.webp   -- EXACT
--   ประปา (Plumbing)            -> original sheet, card captioned "งานประปา"        -> /icons/categories/6.webp   -- EXACT
--   หลังคา (Roofing)            -> original sheet, card captioned "งานหลังคา"       -> /icons/categories/7.webp   -- EXACT
--   ถนน (Road/Driveway)         -> new 4-icon sheet, card captioned "ถนน"           -> /icons/categories/8.webp   -- EXACT
--   งานระบบ (MEP Systems)       -> new 4-icon sheet, card captioned "งานระบบ"       -> /icons/categories/9.webp   -- EXACT
--   อื่นๆ (Other)               -> new 4-icon sheet, card captioned "อื่นๆ"          -> /icons/categories/10.webp  -- EXACT
--
-- All 10 production categories now have a verified, real asset. Nothing
-- is guessed or swapped between categories.
update public.categories set icon = case slug
  when 'สร้างบ้าน'  then '/icons/categories/1.webp'
  when 'ต่อเติม'    then '/icons/categories/2.webp'
  when 'รีโนเวท'    then '/icons/categories/3.webp'
  when 'โครงสร้าง'  then '/icons/categories/4.webp'
  when 'ไฟฟ้า'      then '/icons/categories/5.webp'
  when 'ประปา'      then '/icons/categories/6.webp'
  when 'หลังคา'     then '/icons/categories/7.webp'
  when 'ถนน'        then '/icons/categories/8.webp'
  when 'งานระบบ'    then '/icons/categories/9.webp'
  when 'อื่นๆ'       then '/icons/categories/10.webp'
  else icon
end
where slug in ('สร้างบ้าน', 'ต่อเติม', 'รีโนเวท', 'โครงสร้าง', 'ไฟฟ้า', 'ประปา', 'หลังคา', 'ถนน', 'งานระบบ', 'อื่นๆ');
