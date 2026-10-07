export default function WeeklyReportLoadError() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
        <h1 className="text-xl font-semibold">Báo cáo tuần</h1>
        <p className="mt-2">Không thể tải Báo cáo tuần. Vui lòng thử lại.</p>
      </section>
    </main>
  );
}