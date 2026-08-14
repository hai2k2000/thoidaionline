import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createResetRecord, createResetToken, sendResetEmail } from "@/lib/passwordReset";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const actor = await getSessionUser();
  if (actor?.role_code !== "admin") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: string } | null;
  if (!body?.userId) return NextResponse.json({ error: "Thiếu user." }, { status: 400 });
  const { data } = await serverSupabase.from("staff_users").select("id,email,active").eq("id", body.userId).eq("active", true).maybeSingle();
  if (data?.email) { const { token, hash } = createResetToken(); if (await createResetRecord(data.id, hash)) await sendResetEmail(data.email, token, request); }
  return NextResponse.json({ ok: true });
}
