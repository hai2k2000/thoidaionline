import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  const { error } = await serverSupabase.from("staff_users")
    .update({ session_version: user.session_version + 1 })
    .eq("id", user.id).eq("session_version", user.session_version);
  if (error) return NextResponse.json({ error: "Không thể đăng xuất phiên." }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
