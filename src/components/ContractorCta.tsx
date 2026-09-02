export function ContractorCta() {
  return (
    <section className="bg-gradient-to-br from-brand-300 to-brand-400">
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">คุณเป็นผู้รับเหมาใช่ไหม?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-slate-800">
          เข้าร่วมแพลตฟอร์มเพื่อให้ลูกค้าค้นหาและติดต่อคุณได้ง่ายขึ้น
        </p>
        <a
          href="/signup?role=contractor"
          className="mt-6 inline-block rounded-md bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          สมัครเป็นผู้รับเหมา
        </a>
      </div>
    </section>
  );
}
