import type { ServerAuthUser } from "./serverSession";
import type { AssetRepositoryActor } from "./assetRepository";

export function toAssetRepositoryActor(actor: ServerAuthUser): AssetRepositoryActor {
  return {
    id: actor.id,
    department_id: actor.department_id,
    departmentId: actor.department_id,
    isDepartmentManager: actor.is_department_manager,
    rbacPermissions: actor.rbacPermissions,
  };
}
