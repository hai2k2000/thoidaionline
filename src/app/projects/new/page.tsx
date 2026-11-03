import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { isProjectCreator } from "@/lib/projectApiGuards";
import { projectRepository } from "@/lib/projectRepository";
import ProjectCreateForm from "@/components/ProjectCreateForm";
export default async function NewProjectPage() {
 const user = await getSessionUser(); if (!user) redirect("/login"); if (!isProjectCreator(user)) redirect("/projects");
 const options = await projectRepository.options(); if (!options.ok) throw new Error("Không tải được nhân sự.");
 return <ProjectCreateForm options={options.data} actorId={user.id} />;
}
