import { CURATED_FACEBOOK_ARTICLES } from '../lib/content/facebookArticles';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Home Page "บทความ" section (Issue #42) — Facebook Page Articles MVP.
 * Reads `CURATED_FACEBOOK_ARTICLES` (src/lib/content/facebookArticles.ts),
 * a hand-maintained config array, not a Graph API call — this issue
 * explicitly scopes out automatic ingestion. Adding/removing a post is a
 * one-line edit to that file; this component never needs to change.
 *
 * Every card links straight to the real `facebookPostUrl` (`target`
 * `_blank`, `rel="noopener noreferrer"` since it leaves the site) —
 * "clicking an article opens the original Facebook post", never a
 * reproduction of the post's content on this site.
 *
 * A plain `<img>` (not `next/image`) is used for the optional cover
 * image deliberately: these come from whatever host each curated
 * Facebook post's photo happens to live on, and `next/image` requires
 * every remote host to be allow-listed in `next.config.mjs` ahead of
 * time — broadening that config for an arbitrary future URL is exactly
 * the kind of architecture change this issue says to avoid unless
 * unavoidable, and a plain `<img>` needs no such change.
 *
 * Issue #42, Layer B (comment 5570885896): restyled to match the
 * Owner-supplied combined Testimonials/Articles/Footer Master
 * reference — heading gets the same left yellow accent bar as
 * Testimonials, and each card is now a horizontal (image-left,
 * text-right) layout instead of the previous stacked one, matching
 * the Master exactly. The Master's cards show no excerpt line, so
 * that field is no longer rendered here (the `excerpt` field itself
 * stays in `CuratedFacebookArticle` — untouched data shape, just not
 * displayed on this card). The Master also shows a "ดูบทความทั้งหมด"
 * link, deliberately omitted: this site has no "all articles" page to
 * send it to, and inventing one now would violate this same comment's
 * explicit "Do not invent destination URLs/actions" rule.
 *
 * Still empty by default (see facebookArticles.ts's own header
 * comment for why) — the Owner's instruction here is explicit: "Do
 * not populate fake article content... leave the article content area
 * prepared/empty for a future integration." The skeleton keeps the
 * same real horizontal-card composition a populated card will use via
 * `aria-hidden` dashed placeholders, with an `sr-only` honest "nothing
 * yet" status kept for assistive tech.
 */
export function ArticlesSection() {
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

        {CURATED_FACEBOOK_ARTICLES.length === 0 ? (
          <>
            <p className="sr-only">ยังไม่มีบทความในขณะนี้</p>
            <ul aria-hidden="true" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((slot) => (
                <li
                  key={slot}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3"
                >
                  <AssetPlaceholder label="ภาพปกบทความ" shape="rect" className="h-16 w-16 flex-shrink-0" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-3.5 w-full rounded bg-slate-100" />
                    <div className="h-3.5 w-3/4 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CURATED_FACEBOOK_ARTICLES.map((article) => (
              <li key={article.facebookPostUrl}>
                <a
                  href={article.facebookPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full items-center gap-3 rounded-xl border border-master-border bg-white p-3 hover:border-brand-400 hover:shadow-sm"
                >
                  {article.coverImageUrl ? (
                    <img
                      src={article.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <AssetPlaceholder label="ภาพปกบทความ" shape="rect" className="h-16 w-16 flex-shrink-0" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-master-text">
                      {article.title}
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      {article.publishedAt ? (
                        <span className="text-xs text-slate-400">
                          {new Date(article.publishedAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span />
                      )}
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
