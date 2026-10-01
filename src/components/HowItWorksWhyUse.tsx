import { HomeSectionHeading } from './HomeSectionHeading';
const steps = [
  { title: 'ค้นหาช่าง', text: 'เลือกจังหวัดและประเภทงานที่คุณต้องการ', icon: '01-search' },
  { title: 'ดูข้อมูลและผลงาน', text: 'เปรียบเทียบโปรไฟล์ รีวิว และผลงานจริง', icon: '02-info' },
  { title: 'ติดต่อโดยตรง', text: 'โทรหรือแชทกับช่างได้เลย ไม่ผ่านนายหน้า', icon: '03-contact' },
  { title: 'เริ่มงานได้เลย', text: 'ตกลงรายละเอียดงานกับช่างที่คุณเลือก', icon: '04-start' },
];
const benefits = [
  { title: 'ตรวจสอบแล้ว', text: 'ผ่านการตรวจสอบข้อมูลก่อนเผยแพร่โปรไฟล์', icon: '01-verified' },
  { title: 'ประหยัดเวลา', text: 'ค้นหาและเปรียบเทียบได้ภายในที่เดียว', icon: '02-value' },
  { title: 'ติดต่อโดยตรง', text: 'ไม่มีค่าคอมมิชชัน คุยกับช่างได้เลย', icon: '03-direct' },
  { title: 'รีวิวจากผู้ใช้งานจริง', text: 'ดูผลงานและคะแนนประกอบการตัดสินใจ', icon: '04-reviews' },
];
export function HowItWorksWhyUse() {
  return <>
    <section id="how-it-works" className="home-section" aria-labelledby="how-title">
      <HomeSectionHeading id="how-title" title="วิธีใช้งาน" description="เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย" />
      <ol className="home-steps">{steps.map((step,i) => <li className="home-info-card" key={step.icon}>
        <span className="home-step-number" aria-label={`ขั้นตอนที่ ${i+1}`}>{i+1}</span>
        <img src={`/icons/how-it-works/how-it-works-${step.icon}.webp`} alt="" width="48" height="48" loading="lazy" />
        <h3>{step.title}</h3><p>{step.text}</p>
      </li>)}</ol>
    </section>
    <section className="home-section home-benefits-section" aria-labelledby="why-title">
      <div className="home-benefits-content">
        <HomeSectionHeading id="why-title" title="ทำไมต้องใช้ หาช่าง?" description="แพลตฟอร์มที่เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ" />
        <ul className="home-benefits">{benefits.map(item => <li className="home-info-card" key={item.icon}>
          <img src={`/icons/why-use/why-use-${item.icon}.webp`} alt="" width="44" height="44" loading="lazy" />
          <h3>{item.title}</h3><p>{item.text}</p>
        </li>)}</ul>
      </div>
      <img className="home-benefits-mascot" src="/images/why-use-mascot.png" alt="เรื่องบ้านไว้ใจเรา! ช่างดีต้องที่นี่!" width="1774" height="887" loading="lazy" />
    </section>
  </>;
}
