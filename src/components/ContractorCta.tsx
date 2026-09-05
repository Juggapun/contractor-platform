/**
 * Issue #42 — the four contractor-facing benefit messages are LOCKED
 * (verbatim, product-decided copy — not to be replaced with
 * customer-oriented benefits or paraphrased). No description text is
 * invented for each one: the issue locks exactly these four short
 * messages, so this renders them as-is rather than padding them with
 * unrequested marketing copy this codebase has no data to back up.
 */
const CONTRACTOR_BENEFITS = [
  { icon: '📝', label: 'เพิ่มโปรไฟล์ฟรี' },
  { icon: '🖼️', label: 'ลงผลงานฟรี' },
  { icon: '🌏', label: 'เข้าถึงลูกค้าทั่วไทย' },
  { icon: '✅', label: 'สร้างความน่าเชื่อถือ' },
];

export function ContractorCta() {
  return (
    <section className="bg-gradient-to-br from-brand-300 to-brand-400">
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">คุณเป็นผู้รับเหมาใช่ไหม?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-slate-800">
          เข้าร่วมแพลตฟอร์มเพื่อให้ลูกค้าค้นหาและติดต่อคุณได้ง่ายขึ้น
        </p>

        <ul className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {CONTRACTOR_BENEFITS.map((benefit) => (
            <li
              key={benefit.label}
              className="flex flex-col items-center gap-2 rounded-lg bg-white/60 p-4 text-center"
            >
              <span aria-hidden="true" className="text-2xl">
                {benefit.icon}
              </span>
              <span className="text-sm font-semibold text-slate-900">{benefit.label}</span>
            </li>
          ))}
        </ul>

        <a
          href="/contractors/register"
          className="mt-8 inline-block rounded-md bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          สมัครเป็นผู้รับเหมา
        </a>
      </div>
    </section>
  );
}
