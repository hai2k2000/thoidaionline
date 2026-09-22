import type { ApiErrorCode } from "./apiResponse";

export type RpcError = {
  code?: string | null;
  details?: string | null;
  message?: string | null;
};

export type RpcErrorMapping = {
  code: ApiErrorCode;
  status: number;
};

export function mapRpcError(error: RpcError): RpcErrorMapping {
  if (error.message === "Publication state conflict.") {
    return { code: "publication_state_conflict", status: 409 };
  }
  if (
    error.code === "40001"
    || error.details === "40001"
    || error.message === "Publication report changed before verification."
    || error.code === "55P03"
    || error.details === "55P03"
  ) {
    return { code: "conflict", status: 409 };
  }
  switch (error.code) {
    case "42501":
      return { code: "forbidden", status: 403 };
    case "P0002":
      return { code: "not_found", status: 404 };
    case "22023":
    case "22007":
    case "23514":
      return { code: "invalid_request", status: 400 };
    case "23505":
      return { code: "conflict", status: 409 };
    default:
      return { code: "operation_failed", status: 500 };
  }
}
