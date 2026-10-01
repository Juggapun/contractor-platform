import type { Article } from '../lib/data/articles';
import { AssetPlaceholder } from './AssetPlaceholder';
import { HomeSectionHeading } from './HomeSectionHeading';

export function ArticlesSection({ articles }: { articles: Article[] }) {
  return <section id="articles" className="home-section home-articles-section" aria-labelledby="articles-title">
    <HomeSectionHeading id="articles-title" title="บทความ & เคล็ดลับ" description="ไอเดียดี ๆ เพื่อบ้านในฝันของคุณ" />
    {articles.length === 0 ? <p className="home-empty">ยังไม่มีบทความในขณะนี้</p> :
      <ul className="home-articles">{articles.map(article => <li key={article.id}>
        <a className="home-article-card" href={article.facebookPostUrl} target="_blank" rel="noopener noreferrer">
          {article.coverImageUrl ? <img src={article.coverImageUrl} alt="" width="240" height="240" loading="lazy" /> :
            <AssetPlaceholder label="ภาพปกบทความ" className="home-article-placeholder" />}
          <div className="home-article-copy"><h3>{article.title}</h3>
            <div className="home-article-meta"><time dateTime={article.createdAt} title="วันที่เพิ่มบทความ">{new Date(article.createdAt).toLocaleDateString('th-TH', {year:'numeric',month:'short',day:'numeric'})}</time>
              <span>อ่านต่อ <span aria-hidden="true">→</span><span className="sr-only"> เปิด Facebook ในแท็บใหม่</span></span>
            </div>
          </div>
        </a>
      </li>)}</ul>}
  </section>;
}
