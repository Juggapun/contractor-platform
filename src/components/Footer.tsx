export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-slate-900">ศูนย์รวมผู้รับเหมาไทย</p>
          <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">
            แพลตฟอร์มค้นหาผู้รับเหมาก่อสร้างที่เชื่อถือได้ — ชื่อแบรนด์อย่างเป็นทางการจะประกาศในภายหลัง
          </p>
        </div>

        <nav aria-label="ลิงก์เว็บไซต์">
          <h2 className="text-sm font-semibold text-slate-900">เมนู</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <a href="/" className="hover:text-slate-900 hover:underline">
                หน้าแรก
              </a>
            </li>
            <li>
              <a href="/search" className="hover:text-slate-900 hover:underline">
                ค้นหาผู้รับเหมา
              </a>
            </li>
            <li>
              <a href="/signup?role=contractor" className="hover:text-slate-900 hover:underline">
                เข้าร่วมเป็นผู้รับเหมา
              </a>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">เกี่ยวกับ / ติดต่อ</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>เกี่ยวกับเรา (เร็ว ๆ นี้)</li>
            <li>ติดต่อเรา (เร็ว ๆ นี้)</li>
            <li>นโยบายความเป็นส่วนตัว (เร็ว ๆ นี้)</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} ศูนย์รวมผู้รับเหมาไทย
      </div>
    </footer>
  );
}
