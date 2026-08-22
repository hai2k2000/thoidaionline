"use client";
import {useMemo,useRef,useState} from "react";
type Answer={title:string;text:string;keywords:string[]};
const answers:Answer[]=[
{title:"Tạo và giao công việc",keywords:["tạo","giao","nhiệm vụ","công việc"],text:`Cách tạo và giao công việc:
1. Mở menu Giao việc.
2. Nhập tên và nội dung công việc.
3. Chọn phòng ban, người thực hiện và người duyệt.
4. Chọn ngày bắt đầu, hạn kết thúc, độ khó và tiêu chí đánh giá.
5. Chọn thêm người theo dõi hoặc tệp đính kèm nếu cần.
6. Kiểm tra lại rồi bấm Giao việc.

Sau khi tạo, công việc xuất hiện trong Quản lý công việc. Nếu không thấy người cần chọn, kiểm tra tài khoản còn hoạt động và đúng phòng ban/chức vụ.`},
{title:"Báo cáo tiến độ",keywords:["tiến độ","báo cáo","vướng mắc","bị chặn","đang chờ"],text:`Cách báo cáo tiến độ:
1. Vào Quản lý công việc và mở công việc.
2. Mở mục Tiến độ.
3. Chọn ngày và trạng thái: Đang thực hiện, Có vướng mắc, Đang chờ hoặc Sắp xong.
4. Nhập rõ những việc đã thực hiện.
5. Nếu chọn Có vướng mắc, mô tả vấn đề và điều cần hỗ trợ.
6. Bấm Gửi báo cáo.

Báo cáo tiến độ chưa phải là hoàn thành. Khi đã xong, dùng nút Hoàn thành ở góc trên bên phải.`},
{title:"Hoàn thành và duyệt",keywords:["hoàn thành","xong","duyệt","trả lại"],text:`Quy trình hoàn thành:
1. Người thực hiện mở công việc và bấm Hoàn thành.
2. Công việc chuyển sang chờ duyệt nếu có người duyệt.
3. Người duyệt kiểm tra nội dung, báo cáo và tệp rồi chọn Duyệt hoặc Trả lại.
4. Khi trả lại phải ghi lý do; người thực hiện sửa và gửi lại.

Nếu không thấy nút Hoàn thành, kiểm tra bạn có phải người thực hiện hoặc công việc đã hoàn thành/đã hủy hay chưa.`},
{title:"Quản lý và tìm công việc",keywords:["danh sách","lọc","tìm","quản lý","được giao","theo dõi"],text:`Trong Quản lý công việc:
• Chọn Tất cả, Được giao cho tôi, Nhiệm vụ cá nhân hoặc Tôi theo dõi.
• Tìm theo tên; lọc trạng thái, thời hạn, khoảng ngày và phòng ban.
• Bấm một dòng để mở chi tiết.
• Bấm Đặt lại để xóa bộ lọc.

Nếu danh sách trống, hãy bấm Đặt lại rồi kiểm tra lại phạm vi đang chọn.`},
{title:"Nhiệm vụ cá nhân",keywords:["cá nhân","kế hoạch","tự tạo","đổi ngày","hủy nhiệm vụ"],text:`Cách tạo nhiệm vụ cá nhân:
1. Vào Quản lý công việc và bấm + Tạo công việc.
2. Chọn Nhiệm vụ cá nhân.
3. Nhập nội dung, ngày bắt đầu, ngày kết thúc rồi lưu.
4. Trong quá trình làm có thể báo cáo, đổi ngày hoặc hủy.
5. Khi xong, mở chi tiết và bấm Hoàn thành.`},
{title:"Lịch trực",keywords:["lịch trực","trực","ca trực","biên tập","xuất bản"],text:`Cách dùng lịch trực:
• Mọi người: vào Lịch trực và xem theo Ngày, Tuần hoặc Tháng.
• Admin: vào Cấu hình → Quản trị lịch trực, chọn tháng và phân công từng vị trí.
• Vị trí Phóng viên chỉ có phóng viên tiếng Việt.
• Hạn nhiệm vụ trực là 22:00 ngày trực.
• Có thể để trống vị trí chưa xác định, bổ sung sau rồi bấm Lưu.`},
{title:"Lịch làm online",keywords:["online","ngoại ngữ","tiếng anh","tiếng trung","khmer","tiếng nga"],text:`Cách dùng lịch online ngoại ngữ:
• Mọi người xem tại Lịch làm online theo Ngày, Tuần hoặc Tháng.
• Admin vào Cấu hình → Quản trị lịch online và chọn tháng.
• Mỗi ngày mặc định có một ô chọn người.
• Chọn người đầu tiên rồi bấm + Thêm người nếu cần nhiều người.
• Không thể chọn trùng; bấm × để bỏ người được thêm rồi Lưu.`},
{title:"Đánh giá nhân viên",keywords:["đánh giá","chấm điểm","nhận xét","nhân viên","lãnh đạo"],text:`Quy trình đánh giá:
1. Trưởng phòng trở lên mở Đánh giá nhân viên.
2. Chọn khoảng thời gian.
3. Bấm tên nhân viên để xem công việc trong kỳ.
4. Đối chiếu tên việc, độ khó, trạng thái và thời hạn.
5. Trưởng phòng đánh giá bước 1; lãnh đạo đánh giá bước 2 khi áp dụng.

Nếu không thấy menu, admin cần kiểm tra role và quyền đánh giá của tài khoản.`},
{title:"Đổi hoặc quên mật khẩu",keywords:["mật khẩu","password","đăng nhập","quên","sai mật khẩu"],text:`Đổi mật khẩu của bạn:
1. Mở menu Tài khoản.
2. Nhập mật khẩu hiện tại, mật khẩu mới và xác nhận.
3. Bấm Đổi mật khẩu.

Nếu quên: bấm Quên mật khẩu? ở màn hình đăng nhập.
Admin có thể vào Quản lý nhân viên để đặt mật khẩu mới. Nếu mật khẩu đúng nhưng vẫn không vào được, kiểm tra tài khoản, role quyền và chức vụ có đang hoạt động hay không.`},
{title:"Bình luận và theo dõi",keywords:["bình luận","comment","theo dõi","trao đổi"],text:`Cách trao đổi:
1. Mở chi tiết công việc.
2. Tìm mục Trao đổi.
3. Nhập bình luận và bấm Gửi.

Người thực hiện và người theo dõi được bình luận. Khi giao việc, trưởng phòng của người thực hiện được theo dõi mặc định và có thể chọn thêm người.`},
{title:"Tệp đính kèm",keywords:["file","tệp","đính kèm","tải lên","upload"],text:`Cách tải tệp:
1. Tại màn giao việc hoặc chi tiết, chọn tệp.
2. Chờ thông báo tải thành công trước khi rời trang.
3. Tệp xuất hiện trong mục Đính kèm; bấm Tải xuống để xem.

Nếu lỗi, kiểm tra định dạng, dung lượng, mạng và thử đổi tên tệp ngắn hơn.`}
];
const norm=(v:string)=>v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const find=(q:string)=>{const n=norm(q);const s=answers.map(answer=>({answer,score:answer.keywords.filter(k=>n.includes(norm(k))).length})).sort((a,b)=>b.score-a.score);return s[0]?.score?s[0].answer:null};
export default function HelpBot(){const[open,setOpen]=useState(false);const[question,setQuestion]=useState("");const[messages,setMessages]=useState<{from:"bot"|"user";text:string}[]>([{from:"bot",text:"Xin chào! Hãy mô tả việc muốn làm. Tôi sẽ hướng dẫn từng bước và nêu cách xử lý lỗi thường gặp."}]);const end=useRef<HTMLDivElement>(null);const suggestions=useMemo(()=>answers.slice(0,6),[]);const ask=(value=question)=>{const text=value.trim();if(!text)return;const answer=find(text);setMessages(cur=>[...cur,{from:"user",text},{from:"bot",text:answer?.text??`Tôi chưa xác định đúng nội dung. Hãy hỏi cụ thể hơn, ví dụ:\n• Cách giao công việc\n• Cách báo cáo vướng mắc\n• Cách thêm người làm online\n• Vì sao không đăng nhập được`}]);setQuestion("");setTimeout(()=>end.current?.scrollIntoView({behavior:"smooth"}),0)};return <div className="fixed bottom-4 right-4 z-[70]">{open?<section aria-label="Trợ lý hướng dẫn sử dụng" className="mb-2 flex h-[min(620px,calc(100vh-6rem))] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"><header className="flex items-center justify-between bg-orange-600 px-4 py-3 text-white"><div><p className="font-bold">Trợ lý Thời Đại Work</p><p className="text-xs text-orange-100">Hướng dẫn chi tiết từng bước</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Đóng trợ lý" className="px-2 text-lg">×</button></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm leading-6">{messages.map((m,i)=><div key={i} className={`max-w-[94%] whitespace-pre-wrap rounded-xl px-3 py-2 ${m.from==="user"?"ml-auto bg-slate-100":"bg-orange-50"}`}>{m.text}</div>)}<div ref={end}/></div><div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto border-t px-3 py-2">{suggestions.map(s=><button key={s.title} type="button" onClick={()=>ask(s.title)} className="rounded-full border px-2 py-1 text-xs text-orange-700">{s.title}</button>)}</div><form onSubmit={e=>{e.preventDefault();ask()}} className="flex gap-2 border-t p-3"><textarea rows={2} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ví dụ: Báo cáo tiến độ thế nào?" aria-label="Câu hỏi cho trợ lý" className="min-w-0 flex-1 resize-none rounded-lg border px-3 py-2 text-sm"/><button className="self-end rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Gửi</button></form></section>:null}<button type="button" onClick={()=>setOpen(v=>!v)} aria-label="Mở trợ lý hướng dẫn" className="ml-auto flex items-center gap-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-700">💬 Trợ giúp</button></div>}
