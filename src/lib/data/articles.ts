/**
 * Home Page "บทความ & เคล็ดลับ" section (Issue #42) — reads the
 * admin-managed `articles` table (0024_articles.sql) through the anon
 * client. RLS's `articles_select_all` policy already makes every row
 * public; the explicit `.order`/`.limit` here is just this app's
 * established "never an unbounded fetch" posture, not the enforcement
 * boundary.
 *
 * Replaces the earlier curated-array approach
 * (src/lib/content/facebookArticles.ts, now retired) — an admin adds/
 * edits/removes entries through app/admin/articles (backed by
 * app/api/admin/articles/**), not by editing a source file.
 *
 * Every row shows regardless of `cover_image_status` — a failed image
 * fetch (rare, and visible to the admin in the management UI) does not
 * hide the admin's own real title/link; ArticlesSection.tsx already
 * falls back to its neutral placeholder whenever `coverImageUrl` is
 * absent, exactly the same as an in-progress/never-fetched image.
 */
import { getSupabaseClient } from '../supabase/client';

const ARTICLES_LIMIT = 12;

export interface Article {
  id: string;
  title: string;
  facebookPostUrl: string;
  coverImageUrl: string | null;
  createdAt: string;
}

interface RawArticleRow {
  id: string;
  title: string;
  facebook_post_url: string;
  cover_image_url: string | null;
  created_at: string;
}

export async function getArticles(): Promise<Article[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('articles')
      .select('id, title, facebook_post_url, cover_image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(ARTICLES_LIMIT);

    if (error) {
      console.error('getArticles: query failed', error.message);
      return [];
    }

    const rows = (data ?? []) as RawArticleRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      facebookPostUrl: row.facebook_post_url,
      coverImageUrl: row.cover_image_url,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('getArticles: Supabase not reachable/configured', err);
    return [];
  }
}
