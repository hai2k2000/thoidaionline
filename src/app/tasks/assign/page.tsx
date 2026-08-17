import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { canAccessTaskAssignment } from "@/lib/taskAssignAccess";

export default async function TaskAssignPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (
    !canAccessTaskAssignment({
      can_assign_task: user.permissions.can_assign_task,
    })
  ) redirect("/tasks");

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto w-full">
        <header className="rounded-xl border bg-white p-4 shadow-sm">
          <Link
            href="/tasks"
            className="text-sm font-semibold text-orange-700 hover:underline"
          >
            &#8592; Quay l&#7841;i Qu&#7843;n l&#253; c&#244;ng vi&#7879;c
          </Link>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">GIAO VI&#7878;C</h1>
          <p className="mt-1 text-sm text-slate-600">
            T&#7841;o c&#244;ng vi&#7879;c cho c&#225; nh&#226;n, nh&#243;m ho&#7863;c ph&#242;ng ban theo ph&#7841;m vi &#273;&#432;&#7907;c c&#7845;p.
          </p>
        </header>

        <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Bi&#7875;u m&#7851;u giao vi&#7879;c</h2>
          <p className="mt-2 text-sm text-slate-600">
            Route shell &#273;&#227; &#273;&#432;&#7907;c b&#7843;o v&#7879; b&#7857;ng permission. Workflow giao vi&#7879;c &#273;&#7847;y &#273;&#7911; s&#7869; &#273;&#432;&#7907;c tri&#7875;n khai &#7903; Phase 6.
          </p>
        </section>
      </div>
    </main>
  );
}
