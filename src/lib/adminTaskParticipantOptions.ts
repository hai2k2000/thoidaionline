import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import type { CollaboratorCandidate } from "@/lib/taskAssignmentRepository";

export async function adminTaskParticipantOptions(projectId: string | null, actorId: string, departmentId: string | null) {
  const users = await serverSupabase.from("staff_users")
    .select("id,full_name,username,department_id,roles(code),job_titles(code,active)").eq("active", true).order("full_name");
  if (users.error) throw new Error("Không thể tải danh sách người tham gia.");
  const people: CollaboratorCandidate[] = users.data
    .filter(row => {
      const roles = row.roles as { code?: string } | { code?: string }[] | null;
      const code = Array.isArray(roles) ? roles[0]?.code : roles?.code;
      return code?.toLowerCase() !== "admin";
    })
    .map(row => ({ id: row.id, fullName: row.full_name, username: row.username }));
  const reviewers: CollaboratorCandidate[] = users.data.map(row => ({ id: row.id, fullName: row.full_name, username: row.username }));
  if (!projectId) {
    const department = departmentId ? await serverSupabase.from("departments")
      .select("manager_id").eq("id", departmentId).eq("active", true).maybeSingle() : null;
    if (department?.error) throw new Error("Không thể tải phòng ban của công việc.");
    const eligible = users.data.filter(row => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      if (!role) return false;
      if (row.id === department?.data?.manager_id) return true;
      const title = Array.isArray(row.job_titles) ? row.job_titles[0] : row.job_titles;
      // Match the trigger's branch order: a department title takes precedence over a senior role.
      if (title?.active && ["truong_phong", "pho_truong_phong"].includes(title.code.toLowerCase())) {
        return row.department_id === departmentId;
      }
      return ["phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap", "pho_tong_bien_tap", "tong_bien_tap"].includes(role.code.toLowerCase());
    });
    return { people, reviewers: reviewers.filter(person => eligible.some(row => row.id === person.id)) };
  }
  const members = await serverSupabase.from("project_members").select("user_id,role").eq("project_id", projectId);
  if (members.error) throw new Error("Không thể tải thành viên dự án.");
  return {
    people: people.filter(person => members.data.some(member => member.user_id === person.id)),
    reviewers: reviewers.filter(person => person.id === actorId || members.data.some(member => member.user_id === person.id && member.role === "lead")),
  };
}
