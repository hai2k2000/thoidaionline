"use client";

import { useMemo, useState } from "react";

type Answer = { title: string; text: string; keywords: string[] };
const answers: Answer[] = [
  { title: "Tạo công việc", text: "Vào Giao việc hoặc bấm + Tạo công việc, nhập nội dung, người thực hiện, hạn và tiêu chí đánh giá rồi bấm Giao việc.", keywords: ["tạo", "giao", "nhiệm vụ", "công việc"] },
  { title: "Báo cáo tiến độ", text: "Mở chi tiết công việc, vào phần Tiến độ, chọn ngày và trạng thái. Nhập những gì đã thực hiện; nếu có vướng mắc, chọn Có vướng mắc và mô tả nguyên nhân.", keywords: ["tiến độ", "báo cáo", "vướng mắc", "bị chặn"] },
  { title: "Hoàn thành công việc", text: "Trong trang chi tiết công việc, bấm Hoàn thành ở góc trên bên phải. Nếu công việc cần duyệt, người duyệt sẽ xử lý tiếp.", keywords: ["hoàn thành", "xong", "duyệt"] },
  { title: "Lịch trực", text: "Vào Lịch trực để xem theo ngày, tuần hoặc tháng. Admin cấu hình tại Quản trị lịch trực; ngày thiếu vị trí vẫn có thể lưu.", keywords: ["lịch trực", "trực", "ngày", "tuần", "tháng"] },
  { title: "Lịch làm online", text: "Vào Lịch làm online (ngoại ngữ) để xem lịch. Admin vào Quản trị lịch online, chọn tháng, chọn người đầu tiên rồi bấm + Thêm người nếu cần.", keywords: ["online", "ngoại ngữ", "phóng viên"] },
  { title: "Đánh giá nhân viên", text: "Cấp trưởng phòng trở lên vào Đánh giá nhân viên, lọc thời gian, chọn nhân viên để xem công việc và nhập nhận xét.", keywords: ["đánh giá", "chấm điểm", "nhân viên"] },
  { title: "Đổi mật khẩu", text: "Vào Tài khoản để đổi mật khẩu của chính mình. Admin có thể đặt lại mật khẩu cho nhân viên trong Quản lý nhân viên.", keywords: ["mật khẩu", "password", "đăng nhập"] },
];

function findAnswer(question: string) {
  const normalized = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const scored = answers.map((answer) => ({ answer, score: answer.keywords.filter((keyword) => normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).length })).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].answer : null;
}

export default function HelpBot() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ from: "bot" | "user"; text: string }[]>([
    { from: "bot", text: "Xin chào! Tôi có thể hướng dẫn nhanh cách sử dụng phần mềm. Bạn muốn hỏi gì?" },
  ]);
  const suggestions = useMemo(() => answers.slice(0, 4), []);
  const ask = (value = question) => {
    const text = value.trim();
    if (!text) return;
    const answer = findAnswer(text);
    setMessages((current) => [...current, { from: "user", text }, { from: "bot", text: answer?.text ?? "Mình chưa tìm thấy hướng dẫn phù hợp. Bạn thử hỏi về giao việc, tiến độ, lịch trực, lịch online, đánh giá hoặc mật khẩu nhé." }]);
    setQuestion("");
  };
  return <div className="fixed bottom-4 right-4 z-[70]">
    {open ? <section aria-label="Trợ lý hướng dẫn sử dụng" className="mb-2 flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
      <header className="flex items-center justify-between bg-orange-600 px-4 py-3 text-white"><div><p className="font-bold">Trợ lý Thời Đại Work</p><p className="text-xs text-orange-100">Hướng dẫn sử dụng phần mềm</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">×</button></header>
      <div className="max-h-72 space-y-2 overflow-y-auto p-3 text-sm">{messages.map((message, index) => <p key={index} className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 ${message.from === "user" ? "ml-auto bg-slate-100" : "bg-orange-50 text-slate-800"}`}>{message.text}</p>)}</div>
      <div className="flex flex-wrap gap-1 px-3 pb-2">{suggestions.map((suggestion) => <button key={suggestion.title} type="button" onClick={() => ask(suggestion.title)} className="rounded-full border px-2 py-1 text-xs text-orange-700">{suggestion.title}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); ask(); }} className="flex gap-2 border-t p-3"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Nhập câu hỏi..." aria-label="Câu hỏi cho trợ lý" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Gửi</button></form>
    </section> : null}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Mở trợ lý hướng dẫn" className="ml-auto flex items-center gap-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-700">💬 Trợ giúp</button>
  </div>;
}
