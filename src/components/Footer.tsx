import { ArtworkDetail } from './ArtworkDetail';

const socials = [
  {label:'Facebook',href:'https://www.facebook.com/ChiphiEngineering/',icon:'/icons/social/facebook.svg'},
  {label:'YouTube',href:'https://www.youtube.com/@%E0%B8%8A%E0%B8%B4%E0%B8%9B%E0%B8%AB%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%8A%E0%B9%88%E0%B8%B2%E0%B8%87',icon:'/icons/social/youtube.svg'},
  {label:'TikTok',href:'https://www.tiktok.com/@chiphi_engineering',icon:'/icons/social/tiktok.svg'},
  {label:'LINE',href:`https://line.me/R/ti/p/${encodeURIComponent('@321cvbmm')}`,icon:'/icons/social/line.svg'},
];
const source = {src:'/images/footer-master.png',sourceWidth:2172,sourceHeight:499};
export function Footer() {
  return <footer className="site-footer">
    <div className="site-footer-grid">
      <div id="about-footer" className="site-footer-brand">
        <a href="/" aria-label="หาช่าง — หน้าแรก"><ArtworkDetail {...source} box={[120,20,290,235]} className="site-footer-logo" /></a>
        <p>แพลตฟอร์มศูนย์รวมผู้รับเหมาไทย<br />เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ</p>
      </div>
      <nav aria-label="เมนูท้ายเว็บ"><h2>เมนู</h2><ul>
        <li><a href="/">หน้าแรก</a></li><li><a href="/search">ค้นหาช่าง</a></li>
        <li><a href="/contractors/register">สำหรับช่าง</a></li><li><a href="/#articles">บทความ</a></li>
        <li><a href="#about-footer">เกี่ยวกับเรา</a></li>
      </ul></nav>
      <div className="site-footer-help"><h2>ช่วยเหลือ</h2><ul>
        {['คำถามที่พบบ่อย','ติดต่อเรา','ข้อกำหนดการใช้งาน','นโยบายความเป็นส่วนตัว'].map(text => <li key={text}>{text} <small>(เร็ว ๆ นี้)</small></li>)}
      </ul></div>
      <div className="site-footer-social"><h2>ติดตามเรา</h2><ul>{socials.map(s => <li key={s.label}>
        <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.label} เปิดในแท็บใหม่`}><img src={s.icon} alt="" width="36" height="36" /></a>
      </li>)}</ul></div>
      <div className="site-footer-slogan"><ArtworkDetail {...source} box={[1710,45,370,315]} /><span className="sr-only">หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า</span></div>
    </div>
    <p className="site-footer-copyright">© {new Date().getFullYear()} หาช่าง. สงวนลิขสิทธิ์ทุกประการ</p>
  </footer>;
}
