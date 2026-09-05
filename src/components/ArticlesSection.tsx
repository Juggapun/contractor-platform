import { CURATED_FACEBOOK_ARTICLES } from '../lib/content/facebookArticles';

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
 * Empty by default (see that file's own header comment for why) —
 * renders the same honest "nothing yet" empty state CategoryGrid.tsx
 * already established for this codebase, never a fabricated post.
 */
export function ArticlesSection() {
  return (
    <section id="articles" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">บทความ &amp; เคล็ดลับ</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600">
          ไอเดียดี ๆ เพื่อบ้านในฝันของคุณ จากเพจ Facebook ของเรา
        </p>

        {CURATED_FACEBOOK_ARTICLES.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีบทความในขณะนี้
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {CURATED_FACEBOOK_ARTICLES.map((article) => (
              <li key={article.facebookPostUrl}>
                <a
                  href={article.facebookPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-brand-400 hover:shadow-sm"
                >
                  {article.coverImageUrl ? (
                    <img
                      src={article.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="text-base font-semibold text-slate-900">{article.title}</h3>
                    {article.excerpt ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{article.excerpt}</p>
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
