-- =====================================================================
-- supabase/seed.sql
-- PHASE 2 seed data.
-- Run AFTER all migrations in supabase/migrations/ have been applied.
--
-- Sources:
--   provinces  — kongvut/thai-province-data (MIT), api/latest/province.json
--                https://github.com/kongvut/thai-province-data
--                Verified against the 77-province list; ids preserved
--                from source so districts.province_id (seeded separately,
--                see scripts/seed-districts.mjs) lines up without remapping.
--   categories — the 10 categories specified in the PHASE 2 founder decision
--
-- Slug language: Thai (founder decision, updated after PHASE 2 — the team
-- meets/works in Thai, so province/district/category/contractor slugs use
-- the Thai name directly rather than an English transliteration).
--
-- Districts (928 rows) are intentionally NOT hardcoded in this file —
-- see "KNOWN RISK — districts seed" in docs/DATABASE.md and the PHASE 2
-- self-review report for why, and scripts/seed-districts.mjs for how
-- they are seeded instead.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Provinces (77 rows, full country, per founder decision)
-- slug = Thai province name, spaces (if any) replaced with '-'
-- ---------------------------------------------------------------------
insert into public.provinces (id, name_th, name_en, slug, region) values
  (1, 'กรุงเทพมหานคร', 'Bangkok', 'กรุงเทพมหานคร', 'central'),
  (2, 'สมุทรปราการ', 'Samut Prakan', 'สมุทรปราการ', 'central'),
  (3, 'นนทบุรี', 'Nonthaburi', 'นนทบุรี', 'central'),
  (4, 'ปทุมธานี', 'Pathum Thani', 'ปทุมธานี', 'central'),
  (5, 'พระนครศรีอยุธยา', 'Phra Nakhon Si Ayutthaya', 'พระนครศรีอยุธยา', 'central'),
  (6, 'อ่างทอง', 'Ang Thong', 'อ่างทอง', 'central'),
  (7, 'ลพบุรี', 'Lopburi', 'ลพบุรี', 'central'),
  (8, 'สิงห์บุรี', 'Sing Buri', 'สิงห์บุรี', 'central'),
  (9, 'ชัยนาท', 'Chai Nat', 'ชัยนาท', 'central'),
  (10, 'สระบุรี', 'Saraburi', 'สระบุรี', 'central'),
  (11, 'ชลบุรี', 'Chon Buri', 'ชลบุรี', 'east'),
  (12, 'ระยอง', 'Rayong', 'ระยอง', 'east'),
  (13, 'จันทบุรี', 'Chanthaburi', 'จันทบุรี', 'east'),
  (14, 'ตราด', 'Trat', 'ตราด', 'east'),
  (15, 'ฉะเชิงเทรา', 'Chachoengsao', 'ฉะเชิงเทรา', 'east'),
  (16, 'ปราจีนบุรี', 'Prachin Buri', 'ปราจีนบุรี', 'east'),
  (17, 'นครนายก', 'Nakhon Nayok', 'นครนายก', 'central'),
  (18, 'สระแก้ว', 'Sa Kaeo', 'สระแก้ว', 'east'),
  (19, 'นครราชสีมา', 'Nakhon Ratchasima', 'นครราชสีมา', 'northeast'),
  (20, 'บุรีรัมย์', 'Buri Ram', 'บุรีรัมย์', 'northeast'),
  (21, 'สุรินทร์', 'Surin', 'สุรินทร์', 'northeast'),
  (22, 'ศรีสะเกษ', 'Si Sa Ket', 'ศรีสะเกษ', 'northeast'),
  (23, 'อุบลราชธานี', 'Ubon Ratchathani', 'อุบลราชธานี', 'northeast'),
  (24, 'ยโสธร', 'Yasothon', 'ยโสธร', 'northeast'),
  (25, 'ชัยภูมิ', 'Chaiyaphum', 'ชัยภูมิ', 'northeast'),
  (26, 'อำนาจเจริญ', 'Amnat Charoen', 'อำนาจเจริญ', 'northeast'),
  (27, 'หนองบัวลำภู', 'Nong Bua Lam Phu', 'หนองบัวลำภู', 'northeast'),
  (28, 'ขอนแก่น', 'Khon Kaen', 'ขอนแก่น', 'northeast'),
  (29, 'อุดรธานี', 'Udon Thani', 'อุดรธานี', 'northeast'),
  (30, 'เลย', 'Loei', 'เลย', 'northeast'),
  (31, 'หนองคาย', 'Nong Khai', 'หนองคาย', 'northeast'),
  (32, 'มหาสารคาม', 'Maha Sarakham', 'มหาสารคาม', 'northeast'),
  (33, 'ร้อยเอ็ด', 'Roi Et', 'ร้อยเอ็ด', 'northeast'),
  (34, 'กาฬสินธุ์', 'Kalasin', 'กาฬสินธุ์', 'northeast'),
  (35, 'สกลนคร', 'Sakon Nakhon', 'สกลนคร', 'northeast'),
  (36, 'นครพนม', 'Nakhon Phanom', 'นครพนม', 'northeast'),
  (37, 'มุกดาหาร', 'Mukdahan', 'มุกดาหาร', 'northeast'),
  (38, 'เชียงใหม่', 'Chiang Mai', 'เชียงใหม่', 'north'),
  (39, 'ลำพูน', 'Lamphun', 'ลำพูน', 'north'),
  (40, 'ลำปาง', 'Lampang', 'ลำปาง', 'north'),
  (41, 'อุตรดิตถ์', 'Uttaradit', 'อุตรดิตถ์', 'north'),
  (42, 'แพร่', 'Phrae', 'แพร่', 'north'),
  (43, 'น่าน', 'Nan', 'น่าน', 'north'),
  (44, 'พะเยา', 'Phayao', 'พะเยา', 'north'),
  (45, 'เชียงราย', 'Chiang Rai', 'เชียงราย', 'north'),
  (46, 'แม่ฮ่องสอน', 'Mae Hong Son', 'แม่ฮ่องสอน', 'north'),
  (47, 'นครสวรรค์', 'Nakhon Sawan', 'นครสวรรค์', 'central'),
  (48, 'อุทัยธานี', 'Uthai Thani', 'อุทัยธานี', 'central'),
  (49, 'กำแพงเพชร', 'Kamphaeng Phet', 'กำแพงเพชร', 'central'),
  (50, 'ตาก', 'Tak', 'ตาก', 'west'),
  (51, 'สุโขทัย', 'Sukhothai', 'สุโขทัย', 'central'),
  (52, 'พิษณุโลก', 'Phitsanulok', 'พิษณุโลก', 'central'),
  (53, 'พิจิตร', 'Phichit', 'พิจิตร', 'central'),
  (54, 'เพชรบูรณ์', 'Phetchabun', 'เพชรบูรณ์', 'central'),
  (55, 'ราชบุรี', 'Ratchaburi', 'ราชบุรี', 'west'),
  (56, 'กาญจนบุรี', 'Kanchanaburi', 'กาญจนบุรี', 'west'),
  (57, 'สุพรรณบุรี', 'Suphan Buri', 'สุพรรณบุรี', 'central'),
  (58, 'นครปฐม', 'Nakhon Pathom', 'นครปฐม', 'central'),
  (59, 'สมุทรสาคร', 'Samut Sakhon', 'สมุทรสาคร', 'central'),
  (60, 'สมุทรสงคราม', 'Samut Songkhram', 'สมุทรสงคราม', 'central'),
  (61, 'เพชรบุรี', 'Phetchaburi', 'เพชรบุรี', 'west'),
  (62, 'ประจวบคีรีขันธ์', 'Prachuap Khiri Khan', 'ประจวบคีรีขันธ์', 'west'),
  (63, 'นครศรีธรรมราช', 'Nakhon Si Thammarat', 'นครศรีธรรมราช', 'south'),
  (64, 'กระบี่', 'Krabi', 'กระบี่', 'south'),
  (65, 'พังงา', 'Phangnga', 'พังงา', 'south'),
  (66, 'ภูเก็ต', 'Phuket', 'ภูเก็ต', 'south'),
  (67, 'สุราษฎร์ธานี', 'Surat Thani', 'สุราษฎร์ธานี', 'south'),
  (68, 'ระนอง', 'Ranong', 'ระนอง', 'south'),
  (69, 'ชุมพร', 'Chumphon', 'ชุมพร', 'south'),
  (70, 'สงขลา', 'Songkhla', 'สงขลา', 'south'),
  (71, 'สตูล', 'Satun', 'สตูล', 'south'),
  (72, 'ตรัง', 'Trang', 'ตรัง', 'south'),
  (73, 'พัทลุง', 'Phatthalung', 'พัทลุง', 'south'),
  (74, 'ปัตตานี', 'Pattani', 'ปัตตานี', 'south'),
  (75, 'ยะลา', 'Yala', 'ยะลา', 'south'),
  (76, 'นราธิวาส', 'Narathiwat', 'นราธิวาส', 'south'),
  (77, 'บึงกาฬ', 'Bueng Kan', 'บึงกาฬ', 'northeast')
;

-- keep the sequence in sync since we inserted explicit ids above
select setval(pg_get_serial_sequence('public.provinces', 'id'), (select max(id) from public.provinces));

-- ---------------------------------------------------------------------
-- Categories (10 initial values, per founder decision)
-- slug = Thai category name
-- ---------------------------------------------------------------------
insert into public.categories (name_th, name_en, slug, sort_order) values
  ('สร้างบ้าน',   'Home Building',    'สร้างบ้าน',    1),
  ('ต่อเติม',      'Extension',        'ต่อเติม',      2),
  ('รีโนเวท',      'Renovation',       'รีโนเวท',      3),
  ('โครงสร้าง',    'Structural Work',  'โครงสร้าง',    4),
  ('ไฟฟ้า',        'Electrical',       'ไฟฟ้า',        5),
  ('ประปา',        'Plumbing',         'ประปา',        6),
  ('หลังคา',       'Roofing',          'หลังคา',       7),
  ('ถนน',          'Road/Driveway',    'ถนน',          8),
  ('งานระบบ',      'MEP Systems',      'งานระบบ',      9),
  ('อื่นๆ',         'Other',            'อื่นๆ',         10);

-- ---------------------------------------------------------------------
-- System settings (initial defaults — admin can change without a deploy)
-- All four are marked is_public = true: the frontend needs to read these
-- limits (e.g. to show "12/30 photos used" in the contractor dashboard,
-- or to validate an upload client-side before hitting the server) without
-- being an admin. See ChatGPT security review item 3 / get_setting().
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public) values
  ('free_contractor_portfolio_limit', '30', 'Max portfolio images for a free-tier contractor', true),
  ('free_contractor_project_limit', '10', 'Max distinct project_name groupings within portfolio_images for a free-tier contractor', true),
  ('max_upload_file_size_mb', '10', 'Max original file size accepted by the upload endpoint, before compression', true),
  ('review_max_per_user_per_day', '5', 'Anti-spam: max reviews one user can submit across all contractors per day', true);
