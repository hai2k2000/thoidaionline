import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

type DocRow = {
  doc_code: string;
  title: string;
  processing_deadline: string | null;
  urgency: "normal" | "important" | "urgent";
  status: string;
  owner_user?: { full_name: string } | null;
};

const urgencyEmoji: Record<string, string> = {
  normal: "🔵",
  important: "🟠",
  urgent: "🔴",
};

export async function POST() {
  try {
    if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (actor.role_code !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await serverSupabase
      .from("official_documents")
      .select("doc_code,title,processing_deadline,urgency,status,owner_user:staff_users!official_documents_owner_user_id_fkey(full_name)")
      .not("processing_deadline", "is", null)
      .lte("processing_deadline", today)
      .neq("status", "done")
      .neq("status", "archived")
      .order("processing_deadline", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[notify/doc-overdue] query failed", { code: error.code });
      return NextResponse.json({ error: "Không thể tải danh sách công văn." }, { status: 500 });
    }

    const docs = (data ?? []) as unknown as DocRow[];
    const lines = docs.map((d, i) => {
      const due = d.processing_deadline ? new Date(d.processing_deadline).toLocaleDateString("vi-VN") : "-";
      return `${i + 1}. ${urgencyEmoji[d.urgency] || "•"} ${d.doc_code} - ${d.title} | hạn: ${due} | phụ trách: ${d.owner_user?.full_name || "-"}`;
    });

    const text = docs.length
      ? `📄 Cảnh báo công văn quá hạn\n\n${lines.join("\n")}`
      : "✅ Không có công văn quá hạn.";

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
          subject: "Cảnh báo công văn quá hạn",
          text,
        }),
      });
      if (emailRes.ok) channels.push("email");
    }

    return NextResponse.json({ ok: true, count: docs.length, channels });
  } catch {
    return NextResponse.json({ error: "Không thể gửi thông báo." }, { status: 500 });
  }
}
