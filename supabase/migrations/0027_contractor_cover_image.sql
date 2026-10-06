-- Additive: existing profile and portfolio images are preserved.
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS cover_image_url text;
COMMENT ON COLUMN public.contractors.cover_image_url IS 'Public contractor cover, cropped to 1.8:1; separate from profile avatar and portfolio.';
NOTIFY pgrst, 'reload schema';
