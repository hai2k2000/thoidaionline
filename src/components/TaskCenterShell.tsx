"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { TaskCenterView } from "@/lib/taskCenterView";

type TaskCenterShellProps = {
  canAssignTask: boolean;
  canViewEvaluations: boolean;
  userLabel: string;
  view: TaskCenterView;
};

const tabClass = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    active
      ? "bg-orange-500 text-white"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`;

export default function TaskCenterShell({
  canAssignTask,
  canViewEvaluations,
  userLabel,
  view,
}: TaskCenterShellProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <AppNav currentPath="/tasks" userLabel={userLabel} onLogout={onLogout} />
        <main className="min-w-0 flex-1">
          <header className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              TH&#7900;I &#272;&#7840;I WORK
            </p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  QU&#7842;N L&#221; C&#212;NG VI&#7878;C
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Theo d&#245;i c&#244;ng vi&#7879;c &#273;&#432;&#7907;c giao v&#224; nhi&#7879;m v&#7909; c&#225; nh&#226;n
                </p>
              </div>
              {canAssignTask ? (
                <Link
                  href="/tasks/assign"
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  + Giao vi&#7879;c
                </Link>
              ) : null}
            </div>

            <nav aria-label="Task Center" className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/tasks?view=work"
                aria-current={view === "work" ? "page" : undefined}
                className={tabClass(view === "work")}
              >
                C&#244;ng vi&#7879;c
              </Link>
              {canViewEvaluations ? (
                <Link
                  href="/tasks?view=evaluations"
                  aria-current={view === "evaluations" ? "page" : undefined}
                  className={tabClass(view === "evaluations")}
                >
                  &#272;&#225;nh gi&#225; nh&#226;n vi&#234;n
                </Link>
              ) : null}
            </nav>
          </header>

          <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
            {view === "evaluations" ? (
              <>
                <h2 className="text-lg font-semibold">&#272;&#225;nh gi&#225; nh&#226;n vi&#234;n</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Khu v&#7921;c &#273;&#225;nh gi&#225; &#273;&#432;&#7907;c m&#7903; theo quy&#7873;n c&#7911;a b&#7841;n.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">C&#244;ng vi&#7879;c</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Danh s&#225;ch v&#224; b&#7897; l&#7885;c Task Center s&#7869; &#273;&#432;&#7907;c b&#7893; sung &#7903; Phase 4.
                </p>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
