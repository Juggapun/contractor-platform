/**
 * Issue #42 (Articles, comment 5582752011) — admin-managed Home
 * "บทความ & เคล็ดลับ" entries. Admin-only (requireAdmin); see
 * app/api/admin/_lib/requireAdmin.ts for what that actually enforces.
 *
 * Issue #44: manual add is now title+URL only — no automatic image
 * fetch. The earlier HTML/og:image scraper this route used to call
 * after insert (refreshArticleCoverImage.ts) was removed; a manually
 * added article simply has no cover image (the neutral placeholder
 * already used for any article without one — see ArticlesSection.tsx)
 * unless the admin instead uses "ดึงโพสต์ล่าสุดจาก Facebook"
 * (app/api/admin/articles/facebook/**), the new, safe, Graph-API-backed
 * way to get a real image. Keeping both an auto-scrape AND the Graph
 * API path would be exactly the "two competing import paths that can
 * create inconsistent data" Issue #44 explicitly says not to leave.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '../_lib/requireAdmin';
import { parseFacebookPostUrl } from '@/lib/articles/facebookUrl';

const ARTICLE_COLUMNS =
  'id, facebook_post_url, title, cover_image_url, cover_image_status, cover_image_error, created_at, updated_at';
const MAX_TITLE_LENGTH = 200; // matches articles_title_length (0024_articles.sql)

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const adminClient = getSupabaseAdminClient();
  const { data, error } = await adminClient
    .from('articles')
    .select(ARTICLE_COLUMNS)
    .order('created_at', { ascending: false })
    // Bounded, matching this project's established convention for every
    // other admin list route (e.g. app/api/admin/contractors/route.ts).
    .range(0, 199);

  if (error) {
    console.error('admin articles list: query failed', error);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถโหลดรายการบทความได้' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, articles: data ?? [] });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { facebookPostUrl, title } = (body ?? {}) as { facebookPostUrl?: unknown; title?: unknown };

  if (typeof facebookPostUrl !== 'string' || typeof title !== 'string') {
    return NextResponse.json({ ok: false, error: 'กรุณาระบุ URL ของโพสต์ Facebook และหัวข้อ' }, { status: 400 });
  }
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return NextResponse.json({ ok: false, error: 'กรุณาระบุหัวข้อ' }, { status: 400 });
  }
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ ok: false, error: `หัวข้อยาวเกินไป (สูงสุด ${MAX_TITLE_LENGTH} ตัวอักษร)` }, { status: 400 });
  }
  const parsedUrl = parseFacebookPostUrl(facebookPostUrl);
  if (!parsedUrl.ok) {
    return NextResponse.json({ ok: false, error: parsedUrl.error }, { status: 400 });
  }
  const normalizedUrl = parsedUrl.url.toString();

  const adminClient = getSupabaseAdminClient();
  const { data: inserted, error: insertError } = await adminClient
    .from('articles')
    .insert({
      facebook_post_url: normalizedUrl,
      title: trimmedTitle,
      created_by: auth.adminId,
      cover_image_status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('admin articles create: insert failed', insertError);
    return NextResponse.json({ ok: false, error: 'ไม่สามารถเพิ่มบทความได้' }, { status: 500 });
  }

  // Comment 5584109190, point 2: Home's `revalidate = 3600` (app/page.tsx)
  // previously meant a newly added article sat invisible for up to an
  // hour. This is the server-side admin mutation path itself (unlike
  // Testimonials' ReviewForm.tsx, which submits client-side and needed a
  // separate public /api/revalidate-home endpoint to reach this same
  // call) — busting the cache directly here needs no extra route.
  revalidatePath('/');

  const { data: finalRow, error: fetchError } = await adminClient
    .from('articles')
    .select(ARTICLE_COLUMNS)
    .eq('id', inserted.id)
    .single();

  if (fetchError || !finalRow) {
    console.error('admin articles create: re-fetch after insert failed', fetchError);
    return NextResponse.json({ ok: true, article: { id: inserted.id, title: trimmedTitle, facebook_post_url: normalizedUrl } });
  }
  return NextResponse.json({ ok: true, article: finalRow });
}
