import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

type StaffIdentifierLookupOptions = {
  activeOnly?: boolean;
};

export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function findStaffByIdentifier(
  identifier: string,
  select: string,
  options: StaffIdentifierLookupOptions = {},
) {
  if (!identifier || identifier.length > 254) return { data: null, error: null };

  const createQuery = () => {
    let query = serverSupabase.from("staff_users").select(select);
    if (options.activeOnly) query = query.eq("active", true);
    return query;
  };
  const lookups = [() => createQuery().eq("username", identifier)];
  // PostgREST rewrites * as an ilike wildcard, so it cannot be matched literally.
  if (!identifier.includes("*")) {
    lookups.push(() => createQuery().ilike("email", escapeIlikeLiteral(identifier)));
  }
  lookups.push(() => createQuery().eq("phone", identifier));

  for (const lookup of lookups) {
    const result = await lookup().limit(1).maybeSingle();
    if (result.error || result.data) return result;
  }

  return { data: null, error: null };
}
