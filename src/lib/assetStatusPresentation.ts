export const assetStatusLabels = {
  in_use: "Đang sử dụng",
  maintenance: "Cần bảo trì",
  broken: "Hỏng",
  pending: "Đang chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
} as const;

export function presentAssetStatus(status: string | null | undefined) {
  return status ? assetStatusLabels[status as keyof typeof assetStatusLabels] ?? status : "-";
}
