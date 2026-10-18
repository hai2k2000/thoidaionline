export type DatabaseRecordStatus = "draft" | "pending_review" | "approved" | "archived" | "deleted";
export type DatabaseAclPrincipalType = "user" | "role" | "department";
export type DatabaseAclCapability =
  | "discover" | "metadata.view" | "preview" | "download" | "edit"
  | "approve" | "delete" | "restore" | "export" | "acl.manage";
export type DatabaseAclEffect = "allow" | "deny";

export type DatabaseRecordInput = {
  categoryId: string;
  recordTypeId: string;
  recordCode: string;
  title: string;
  summary?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  status?: DatabaseRecordStatus;
  metadata: Record<string, unknown>;
  keywords?: string[];
  externalLinks?: Array<{ provider: "google_drive"; url: string; label?: string | null; mediaKind?: "image" | "audio" | "video" | null }>;
};

export type DatabaseRecordAclInput = {
  principalType: DatabaseAclPrincipalType;
  principalId: string;
  capability: DatabaseAclCapability;
  effect: DatabaseAclEffect;
  expiresAt?: string | null;
};

export type DatabaseRecordUpdateInput = Partial<Pick<DatabaseRecordInput,
  "recordCode" | "title" | "summary" | "metadata" | "keywords" | "externalLinks"
>>;
