import type { Article } from '../lib/data/articles';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Home Page "บทความ" section (Issue #42) — Facebook Page Articles.
 *
 * Every card links straight to the real `facebookPostUrl` (`target`
 * `_blank`, `rel="noopener noreferrer"` since it leaves the site) —
 * "clicking an article opens the original Facebook post", never a
 * reproduction of the post's content on this site.
 *
 * A plain `<img>` (not `next/image`) is used for the cover image
 * deliberately: it points at our own Supabase Storage copy of the
 * fetched og:image (src/lib/storage/articleMedia via contractorMedia.ts),
 * but that URL's exact host still isn't knowable at build time the way
 * a hardcoded `next.config.mjs` remote-image allowlist entry would need
 * — a plain `<img>` needs no such change.
 *
 * Issue #42, Layer B (comment 5570885896): restyled to match the
 * Owner-supplied combined Testimonials/Articles/Footer Master
 * reference — heading gets the same left yellow accent bar as
 * Testimonials, and each card is a horizontal (image-left, text-right)
 * layout matching the Master. The Master's cards show no excerpt line,
 * so that field is never rendered here. The Master also shows a
 * "ดูบทความทั้งหมด" link, deliberately omitted: this site has no "all
 * articles" page to send it to, and inventing one now would violate
 * this same comment's explicit "Do not invent destination URLs/actions"
 * rule.
 *
 * Issue #42, Articles Layer B (comment 5581851755): card image geometry
 * originally measured as a flush, ~45%-width, full-height *cover* image.
 *
 * Issue #45 (comment 5600382106) — Owner Production QA: that `object-cover`
 * treatment was cropping pieces off whatever image the admin actually
 * uploaded (a manually-picked photo, not a Facebook-supplied og:image
 * anymore — see AdminArticlesManager.tsx). Changed to a fixed 1:1
 * square box (`aspect-square`, independent of the card's own height —
 * no more `self-stretch`) with `object-contain`, so the full uploaded
 * image is always visible; any letterbox gap (e.g. the 1200x628
 * landscape shape ARTICLE_COVER_SPEC normalizes uploads to) shows the
 * same neutral slate background the empty-state placeholder already
 * uses, rather than cropping content away. Width stays ~45% as before —
 * only the box's aspect and the image's object-fit changed.
 *
 * Issue #42, Articles (comment 5582752011, "Admin-managed Facebook
 * posts"): retired the earlier static/curated-array approach
 * (src/lib/content/facebookArticles.ts) in favor of `articles`, real
 * rows from the admin-managed `articles` table
 * (src/lib/data/articles.ts's `getArticles()`) — an admin adds/edits/
 * removes entries through /admin/articles, never by editing a source
 * file. The date shown per card is `createdAt` (when the admin added
 * the entry to this table) — the real Facebook post's own publish date
 * is never fetched/parsed, so nothing here claims to show it.
 */
export function ArticlesSection({ articles }: { articles: Article[] }) {
  return (
    <section id="articles" className="scroll-mt-20 bg-master-page-bg">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-9 sm:px-[53px] lg:py-8">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-1 h-6 w-1 flex-shrink-0 rounded bg-master-yellow-accent" />
          <div>
            <h2 className="text-2xl font-bold text-master-text lg:text-lg">บทความ &amp; เคล็ดลับ</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600 lg:text-xs">
              ไอเดียดี ๆ เพื่อบ้านในฝันของคุณ
            </p>
          </div>
        </div>

        {articles.length === 0 ? (
          <>
            <p className="sr-only">ยังไม่มีบทความในขณะนี้</p>
            <ul aria-hidden="true" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((slot) => (
                <li
                  key={slot}
                  className="flex overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white"
                >
                  <AssetPlaceholder label="ภาพปกบทความ" shape="rect" className="aspect-square w-[45%] flex-shrink-0 self-start rounded-none border-y-0 border-l-0" />
                  <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                    <div className="flex flex-col gap-2">
                      <div className="h-3.5 w-full rounded bg-slate-100" />
                      <div className="h-3.5 w-3/4 rounded bg-slate-100" />
                    </div>
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {articles.map((article) => (
              <li key={article.id}>
                <a
                  href={article.facebookPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full overflow-hidden rounded-xl border border-master-border bg-white hover:border-brand-400 hover:shadow-sm"
                >
                  {article.coverImageUrl ? (
                    <img
                      src={article.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-[45%] flex-shrink-0 self-start bg-slate-100 object-contain"
                    />
                  ) : (
                    <AssetPlaceholder label="ภาพปกบทความ" shape="rect" className="aspect-square w-[45%] flex-shrink-0 self-start rounded-none border-y-0 border-l-0" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-master-text">
                      {article.title}
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        {new Date(article.createdAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-xs font-semibold text-brand-600 underline">อ่านต่อ →</span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
