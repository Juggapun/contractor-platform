import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'วิธีขอลบข้อมูลผู้ใช้',
  description: 'วิธีขอลบบัญชีและข้อมูลที่เชื่อมกับ Facebook Login บนเว็บไซต์หาช่าง',
};

export default function DataDeletionPage() {
  return <article className="mx-auto max-w-3xl px-4 py-12 text-slate-700 sm:px-6">
    <h1 className="text-3xl font-bold text-slate-950">วิธีขอลบข้อมูลผู้ใช้</h1>
    <p className="mt-6">หากคุณสมัครหรือเข้าสู่ระบบหาช่างด้วย Facebook หรืออีเมล คุณสามารถขอให้เราลบบัญชีและข้อมูลที่เกี่ยวข้องได้</p>
    <ol className="mt-6 list-decimal space-y-4 pl-6">
      <li>ติดต่อ <a className="font-semibold text-blue-700 underline" href="https://line.me/R/ti/p/%40321cvbmm" target="_blank" rel="noopener noreferrer">LINE หาช่าง (@321cvbmm)</a> แล้วแจ้งว่า “ขอลบบัญชีและข้อมูลหาช่าง”</li>
      <li>แจ้งอีเมลที่ใช้สมัครบัญชี และระบุว่าต้องการลบข้อมูลใด เช่น บัญชี รีวิว หรือโปรไฟล์ช่าง กรุณาอย่าส่งรหัสผ่านหรือโทเคนให้เรา</li>
      <li>เราจะติดต่อกลับผ่านช่องทางที่ผูกกับบัญชีเพื่อยืนยันตัวตน แล้วตรวจสอบและดำเนินการตามคำขอ แจ้งผลหรือเหตุผลหากมีข้อมูลที่จำเป็นต้องเก็บไว้ตามกฎหมายหรือเพื่อจัดการข้อพิพาท</li>
    </ol>
    <p className="mt-7">หากต้องการยกเลิกการเชื่อมต่อ Facebook คุณสามารถลบการอนุญาตแอป Hachang login ในการตั้งค่า Facebook ได้ด้วย การยกเลิกการเชื่อมต่อเพียงอย่างเดียวไม่ได้ลบข้อมูลที่เคยบันทึกไว้บนหาช่าง กรุณาส่งคำขอตามขั้นตอนข้างต้นหากต้องการลบข้อมูลบนเว็บไซต์</p>
    <p className="mt-7">รายละเอียดเกี่ยวกับข้อมูลที่เราใช้ ดูที่ <a className="font-semibold text-blue-700 underline" href="/privacy">นโยบายความเป็นส่วนตัว</a></p>
  </article>;
}
