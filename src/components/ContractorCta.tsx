import { ArtworkDetail } from './ArtworkDetail';
export function ContractorCta() {
  return <section className="home-cta" aria-labelledby="contractor-cta-title">
    <img className="home-cta-background" src="/home/contractor-cta-art.webp" alt="" width="2158" height="729" loading="lazy" />
    <div className="home-cta-photo"><ArtworkDetail preserveAspectRatio="xMidYMid slice" src="/home/contractor-cta-art.webp" sourceWidth={2158} sourceHeight={729} box={[0,0,640,729]} /></div>
    <div className="home-cta-copy">
      <h2 id="contractor-cta-title">เป็นช่างหรือ<br className="home-cta-break" />ผู้รับเหมาใช่ไหม?</h2>
      <p>สมัครฟรี! เพิ่มโปรไฟล์ โชว์ผลงาน<br />ให้ลูกค้าทั่วไทยเห็นคุณ</p>
      <a className="home-primary-button" href="/contractors/register">สมัครเป็นช่าง <span aria-hidden="true">→</span></a>
    </div>
    <ul className="home-cta-benefits">{['เพิ่มโปรไฟล์ฟรี','ลงผลงานฟรี','เข้าถึงลูกค้าทั่วไทย','สร้างความน่าเชื่อถือ'].map(text =>
      <li key={text}><span aria-hidden="true">✓</span>{text}</li>)}</ul>
  </section>;
}
