import type { ProjectMember } from "./projectRepository";
export function canDeleteCancelledProjectTasks(input: { actorRole: string; actorId: string; members: ProjectMember[]; projectStatus: string; statusFilter: string }): boolean;
