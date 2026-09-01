import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

type TaskRow = {
  title: string;
  due_date: string | null;
  status: string;
  departments?: { name: string } | null;
  staff_users?: { full_name: string } | null;
};

export async function POST(req: Request) {
  try {
    if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (actor.role_code !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 3)));

    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(today.getDate() + days);
    const to = toDate.toISOString().slice(0, 10);

    const { data, error } = await serverSupabase
      .from("tasks")
      .select("title, due_date, status, departments(name), staff_users!tasks_assignee_id_fkey(full_name)")
      .neq("status", "done")
      .not("due_date", "is", null)
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[notify/due-soon] query failed", { code: error.code });
      return NextResponse.json({ error: "Không thể tải danh sách công việc." }, { status: 500 });
    }

    const tasks = (data ?? []) as unknown as TaskRow[];
    const lines = tasks.map((t, i) => {
      const due = t.due_date ? new Date(t.due_date).toLocaleDateString("vi-VN") : "-";
      return `${i + 1}. ${t.title} | hạn: ${due} | phụ trách: ${t.staff_users?.full_name || "-"} | phòng: ${t.departments?.name || "-"}`;
    });

    const text = tasks.length
      ? `📌 Nhắc việc sắp đến hạn (${days} ngày tới)\n\n${lines.join("\n")}`
      : `✅ Không có công việc sắp đến hạn trong ${days} ngày tới.`;

    const channels: string[] = [];

    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChatId, text }),
      });
      if (tgRes.ok) channels.push("telegram");
    }

    const resendKey = process.env.RESEND_API_KEY;
    const emailTo = process.env.NOTIFY_EMAIL_TO;
    const emailFrom = process.env.NOTIFY_EMAIL_FROM || "noreply@thoidai.local";
    if (resendKey && emailTo) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: emailTo,
          subject: `Nhắc việc sắp đến hạn (${days} ngày)`,
          text,
        }),
      });
      if (emailRes.ok) channels.push("email");
    }

    return NextResponse.json({ ok: true, count: tasks.length, days, channels });
  } catch {
    return NextResponse.json({ error: "Không thể gửi thông báo." }, { status: 500 });
  }
}
