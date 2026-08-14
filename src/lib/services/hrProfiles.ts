import { logAudit } from "./audit";
import { db, fail, ok, ServiceResult, withError } from "./common";

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

const nextEmployeeCode = async (): Promise<string> => {
  const { data } = await db.from("employee_profiles").select("employee_code").order("employee_code", { ascending: false }).limit(1).maybeSingle();
  const current = data?.employee_code ?? "NS-0000";
  const n = Number((current.split("-")[1] ?? "0").replace(/\D/g, "")) + 1;
  return `NS-${String(n).padStart(4, "0")}`;
};

export async function listEmployeeProfiles(): Promise<ServiceResult<EmployeeProfile[]>> {
  try {
    const { data, error } = await db.from("employee_profiles").select("*").order("employee_code");
    if (error) return fail(error.message);
    return ok((data ?? []) as EmployeeProfile[]);
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
    const code = input.employee_code?.trim().toUpperCase() || (await nextEmployeeCode());
    const { data, error } = await db
      .from("employee_profiles")
      .upsert({ ...input, employee_code: code, updated_at: new Date().toISOString() })
      .select("*")
      .single();

    if (error) return fail(error.message);

    await logAudit({
      actorId,
      module: "hr",
      entityType: "employee_profiles",
      entityId: data.user_id,
      action: "update",
      newData: data,
    });

    return ok(data as EmployeeProfile);
  } catch (error) {
    return fail(withError(error, "Không lưu được hồ sơ nhân sự."));
  }
}
