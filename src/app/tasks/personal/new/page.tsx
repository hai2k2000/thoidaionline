import Link from "next/link";
import { redirect } from "next/navigation";
import PersonalTaskForm from "@/components/PersonalTaskForm";
import { getSessionUser } from "@/lib/serverSession";

export default async function NewPersonalTaskPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/tasks?scope=personal" className="text-sm font-semibold text-orange-700">← Task Center</Link>
        <h1 className="my-4 text-2xl font-bold">Tạo nhiệm vụ cá nhân</h1>
        <PersonalTaskForm />
      </div>
    </main>
  );
}
