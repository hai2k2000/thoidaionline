import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createResetRecord, createResetToken, GENERIC_RESET_MESSAGE, hashResetFingerprint, sendResetEmail } from "@/lib/passwordReset";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const fingerprint = hashResetFingerprint(ip);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await serverSupabase.from("password_reset_attempts").select("id", { count: "exact", head: true }).eq("fingerprint_hash", fingerprint).gte("created_at", since);
  await serverSupabase.from("password_reset_attempts").insert({ fingerprint_hash: fingerprint });
  if ((count ?? 0) >= 5) return NextResponse.json({ message: GENERIC_RESET_MESSAGE });
  const body = await request.json().catch(() => null) as { identifier?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();
  if (!identifier) return NextResponse.json({ message: GENERIC_RESET_MESSAGE });
  const { data } = await serverSupabase.from("staff_users").select("id,email,active").or(`username.eq.${identifier},email.ilike.${identifier},phone.eq.${identifier}`).eq("active", true).limit(1).maybeSingle();
  if (data?.id && data.email) {
    const { token, hash } = createResetToken();
    if (await createResetRecord(data.id, hash)) await sendResetEmail(data.email, token, request);
  }
  return NextResponse.json({ message: GENERIC_RESET_MESSAGE });
}
