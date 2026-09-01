import { fail, ok, ServiceResult, withError } from "./common";

export type EmployeeProfile = {
  user_id: string;
  employee_code?: string;
  date_of_birth?: string | null;
  gender?: "male" | "female" | "other" | null;
  id_number?: string | null;
  address?: string | null;
  join_date?: string | null;
  contract_type?: "intern" | "probation" | "official" | "contractor" | null;
  contract_start?: string | null;
  contract_end?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  profile_file_url?: string | null;
};

const validateProfile = (input: EmployeeProfile): string | null => {
  if (!input.user_id) return "Thiếu user_id.";
  return null;
};

export async function listEmployeeProfiles(): Promise<ServiceResult<EmployeeProfile[]>> {
  try {
    const response = await fetch("/api/hr/profiles", { cache: "no-store" });
    const body = await response.json().catch(() => null) as { profiles?: EmployeeProfile[]; error?: string } | null;
    if (!response.ok) return fail(body?.error || "Không tải được hồ sơ nhân sự.");
    return ok(body?.profiles ?? []);
  } catch (error) {
    return fail(withError(error, "Không tải được hồ sơ nhân sự."));
  }
}

export async function upsertEmployeeProfile(
  input: EmployeeProfile,
  actorId?: string
): Promise<ServiceResult<EmployeeProfile>> {
  const invalid = validateProfile(input);
  if (invalid) return fail(invalid);

  try {
    const response = await fetch("/api/hr/profiles", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, actorId }) });
    const body = await response.json().catch(() => null) as { profile?: EmployeeProfile; error?: string } | null;
    if (!response.ok) return fail(body?.error || "Không lưu được hồ sơ nhân sự.");
    return body?.profile ? ok(body.profile) : fail("Không lưu được hồ sơ nhân sự.");
  } catch (error) {
    return fail(withError(error, "Không lưu được hồ sơ nhân sự."));
  }
}
