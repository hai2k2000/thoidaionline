import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";

export async function GET() {
  const user = await getSessionUser();
  return user
    ? NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
