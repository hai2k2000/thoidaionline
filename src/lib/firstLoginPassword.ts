export const REQUIRED_PASSWORD_CHANGE_PATH = "/account?changePassword=required";
export type FirstLoginGateDecision =
  | { type: "allow" }
  | { type: "redirect"; location: string }
  | { type: "reject-api" };
export function resolvePostLoginPath(_mustChangePassword: boolean) { return "/tasks"; }
export function getFirstLoginGateDecision(_pathname: string, _mustChangePassword: boolean): FirstLoginGateDecision { return { type: "allow" }; }
