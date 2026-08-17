export type ApiErrorCode =
  | "invalid_origin"
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "service_unavailable"
  | "operation_failed";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function apiJson(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function apiError(
  code: ApiErrorCode,
  status: number,
): Response {
  return apiJson({ error: { code } }, status);
}
