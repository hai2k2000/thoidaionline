export const assetStatusLabels = {
  in_use: "Đang sử dụng",
  maintenance: "Cần bảo trì",
  broken: "Hỏng",
  pending: "Đang chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
} as const;

export const assetConditionLabels = {
  normal: "Bình thường",
  needs_maintenance: "Cần bảo trì",
  under_service: "Đang sửa chữa",
  broken: "Hỏng",
} as const;

export function presentAssetCondition(status: string | null | undefined) {
  return status ? assetConditionLabels[status as keyof typeof assetConditionLabels] ?? status : "Bình thường";
}

export function presentAssetStatus(status: string | null | undefined) {
  return status ? assetStatusLabels[status as keyof typeof assetStatusLabels] ?? status : "-";
}

export function presentAssetUsage(currentAssignment: { id?: string } | null | undefined, status?: string | null) {
  if (status === "liquidated") return "Đã thanh lý";
  return currentAssignment ? "Đang sử dụng" : "Chưa phân công";
}
