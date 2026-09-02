export function Hero() {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          ค้นหาผู้รับเหมาที่เหมาะกับงานของคุณ
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          เปรียบเทียบผู้รับเหมาที่ผ่านการตรวจสอบ ดูผลงานและรีวิวจริง แล้วติดต่อผู้รับเหมาที่ใช่
          สำหรับงานก่อสร้าง ต่อเติม หรือซ่อมแซมบ้านของคุณได้โดยตรง
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#search"
            className="w-full rounded-md bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
          >
            ค้นหาผู้รับเหมาเลย
          </a>
          <a
            href="#how-it-works"
            className="w-full rounded-md border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            ดูวิธีใช้งาน
          </a>
        </div>
      </div>
    </section>
  );
}
