import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PersonalTaskForm from "@/components/PersonalTaskForm";
import { canTaskAction } from "@/lib/authorization";
import { getSessionUser } from "@/lib/serverSession";
import { taskRepository } from "@/lib/taskRepository";

type Props = { params: Promise<{ id: string }> };

export default async function EditPersonalTaskPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [access, detail] = await Promise.all([
    taskRepository.access(id),
    taskRepository.detail(id),
  ]);
  if (!access.ok || !detail.ok || !access.data || !detail.data) notFound();
  const actor = {
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  };
  if (!canTaskAction(actor, access.data, "personal_edit")) redirect("/tasks?scope=personal");
  if (!detail.data.start_date || !detail.data.due_date) notFound();
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/tasks?scope=personal" className="text-sm font-semibold text-orange-700">← Task Center</Link>
        <h1 className="my-4 text-2xl font-bold">Sửa nhiệm vụ cá nhân</h1>
        <PersonalTaskForm initialTask={{
          id: detail.data.id,
          title: detail.data.title,
          description: detail.data.description,
          startDate: detail.data.start_date,
          dueDate: detail.data.due_date,
          evaluationCriteria: detail.data.evaluation_criteria,
        }} />
      </div>
    </main>
  );
}
