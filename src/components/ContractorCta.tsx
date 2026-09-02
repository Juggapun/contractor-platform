export function ContractorCta() {
  return (
    <section className="bg-brand-700">
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-white">คุณเป็นผู้รับเหมาใช่ไหม?</h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-50">
          เข้าร่วมแพลตฟอร์มเพื่อให้ลูกค้าค้นหาและติดต่อคุณได้ง่ายขึ้น
        </p>
        <a
          href="/signup?role=contractor"
          className="mt-6 inline-block rounded-md bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50"
        >
          สมัครเป็นผู้รับเหมา
        </a>
      </div>
    </section>
  );
}
