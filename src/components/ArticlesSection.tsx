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
 * Empty by default (see that file's own header comment for why). Layer A
 * geometry revision: instead of collapsing to a single empty-state line
 * (which under-reserved this section's Master-design height budget),
 * this now reserves 3 real horizontal article-card slots — same
 * cover-image + title/excerpt composition a populated card will use —
 * via `aria-hidden` dashed skeleton cards, with an `sr-only` honest
 * "nothing yet" status kept for assistive tech. No article content is
 * fabricated; the skeleton cards carry no invented text.
 *
 * Issue #42, Layer A final calibration — height locked to ~276px at
 * `lg:` (176/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment).
 * Container width unified to the shared ~1173px content-width token
 * (was `max-w-5xl`/1024px before this pass).
 */
export function ArticlesSection() {
  return (
    <section id="articles" className="scroll-mt-20 bg-master-page-bg lg:flex lg:min-h-[276px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-6 sm:px-[53px] lg:py-3">
        <h2 className="text-center text-2xl font-bold text-master-text lg:text-lg">บทความ &amp; เคล็ดลับ</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:text-xs">
          ไอเดียดี ๆ เพื่อบ้านในฝันของคุณ จากเพจ Facebook ของเรา
        </p>

        {CURATED_FACEBOOK_ARTICLES.length === 0 ? (
          <>
            <p className="sr-only">ยังไม่มีบทความในขณะนี้</p>
            <ul aria-hidden="true" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[0, 1, 2].map((slot) => (
                <li
                  key={slot}
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white"
                >
                  <AssetPlaceholder label="ภาพปกบทความ" shape="rect" className="h-24 w-full flex-shrink-0" />
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="h-4 w-3/4 rounded bg-slate-100" />
                    <div className="h-3 w-full rounded bg-slate-100" />
                    <div className="h-3 w-5/6 rounded bg-slate-100" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {CURATED_FACEBOOK_ARTICLES.map((article) => (
              <li key={article.facebookPostUrl}>
                <a
                  href={article.facebookPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-master-border bg-white hover:border-brand-400 hover:shadow-sm"
                >
                  {article.coverImageUrl ? (
                    <img
                      src={article.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-24 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <h3 className="text-base font-semibold text-master-text">{article.title}</h3>
                    {article.excerpt ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{article.excerpt}</p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
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
                      <span className="text-xs font-semibold text-brand-600">อ่านต่อ →</span>
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
