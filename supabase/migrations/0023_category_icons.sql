-- =====================================================================
-- 0023_category_icons.sql
-- Depends on: 0003_categories.sql
-- Data-only migration: populates categories.icon for Issue #42's
-- Categories Layer B asset insertion.
-- =====================================================================

-- Issue #42, Layer B (Categories) — the Project Owner attached a single
-- 14-icon sheet (comment #5557421867 on Issue #42: one card per work
-- type, each icon + its own Thai caption baked together). This
-- migration points each REAL category (seeded in seed.sql, unchanged
-- here) at its own already-cropped icon file under
-- public/icons/categories/{id}.webp — cropped from that sheet with
-- Pillow (icon graphic only, the sheet's own caption text excluded so
-- it never collides with this table's own name_th rendered by
-- CategoryGrid.tsx) — no icon was redrawn, regenerated, or
-- AI-recreated.
--
-- The sheet supplied 13 real work-type icons for this app's 10 real
-- categories, so most map by an exact label/meaning match. Two did
-- not have a literal match in the supplied sheet and use the closest
-- available icon instead (documented per-row below); if the Project
-- Owner intends a different icon for either, only this UPDATE's
-- target path needs to change — CategoryGrid.tsx needs no code change
-- either way, since it already renders whatever `icon` holds.
update public.categories set icon = case slug
  when 'สร้างบ้าน'  then '/icons/categories/1.webp'  -- sheet's "ต่อเติมบ้าน" house icon (no distinct new-build icon supplied; closest available)
  when 'ต่อเติม'    then '/icons/categories/2.webp'  -- sheet's "ต่อเติมบ้าน" house icon (same source graphic as above, saved as its own independently-replaceable file)
  when 'รีโนเวท'    then '/icons/categories/3.webp'  -- sheet's "ซ่อมแซม / รีโนเวท" hammer icon (exact label match)
  when 'โครงสร้าง'  then '/icons/categories/4.webp'  -- sheet's "งานโครงสร้าง" icon (exact label match)
  when 'ไฟฟ้า'      then '/icons/categories/5.webp'  -- sheet's "งานไฟฟ้า" icon (exact label match)
  when 'ประปา'      then '/icons/categories/6.webp'  -- sheet's "งานประปา" icon (exact label match)
  when 'หลังคา'     then '/icons/categories/7.webp'  -- sheet's "งานหลังคา" icon (exact label match)
  when 'ถนน'        then '/icons/categories/8.webp'  -- APPROXIMATE: sheet's "งานพื้น / กระเบื้อง" (flooring/tiles) icon; no distinct road/driveway icon was supplied
  when 'งานระบบ'    then '/icons/categories/9.webp'  -- APPROXIMATE: sheet's "แอร์ / เครื่องทำความเย็น" (air conditioning) icon, an MEP-system component; no generic building-systems icon was supplied
  when 'อื่นๆ'       then '/icons/categories/10.webp' -- sheet's "ดูทั้งหมด" (view all / three dots) icon — fits "other/misc" by meaning
  else icon
end
where slug in ('สร้างบ้าน', 'ต่อเติม', 'รีโนเวท', 'โครงสร้าง', 'ไฟฟ้า', 'ประปา', 'หลังคา', 'ถนน', 'งานระบบ', 'อื่นๆ');
