## REVIEW BUDGET

- Mỗi task chỉ được tối đa 1 implementation review.
- Nếu task có migration/data/security: cho phép thêm 1 independent review.
- Tổng số review tối đa cho một task: 2.
- Không được tạo reviewer để review kết quả của reviewer khác.
- Không được tạo audit mới nếu audit hiện tại đã PASS.
- PASS là trạng thái kết thúc, không phải lý do để kiểm tra thêm.

## BẮT BUỘC ĐỌC RULECODEX TRƯỚC KHI SỬA DỰ ÁN

- Trước khi thực hiện bất kỳ chỉnh sửa nào trong dự án, mọi agent tham gia (bao gồm main agent, subagent, reviewer và validator có quyền sửa) phải truy cập repo `https://github.com/hai2k2000/rulecodex.git` và đọc đầy đủ các nguyên tắc phù hợp với nhiệm vụ.
- Tài liệu nguyên tắc chính hiện tại là `rule.md`: `https://github.com/hai2k2000/rulecodex/blob/main/rule.md`.
- Phải tuân thủ các nguyên tắc đã đọc cùng với các chỉ dẫn trong file này; nếu có nhiều tài liệu nguyên tắc phù hợp trong repo thì phải đọc đầy đủ tất cả các tài liệu đó trước khi sửa.
- Nếu chưa thể truy cập repo hoặc chưa đọc đầy đủ các nguyên tắc phù hợp, phải dừng lại, không sửa bất kỳ file/cấu hình/dữ liệu nào của dự án và báo rõ blocker cho orchestrator hoặc người dùng.

## BẮT BUỘC COMMIT VÀ PUSH SAU KHI CHỈNH SỬA

- Sau mỗi đợt chỉnh sửa đã đạt Definition of Done, agent phải chạy validation phù hợp, rà soát secret/runtime artifact, commit toàn bộ thay đổi thuộc phạm vi và push lên upstream của branch hiện tại.
- Không được báo hoàn thành khi source đã triển khai nhưng vẫn còn commit local chưa push hoặc file thuộc phạm vi còn dirty/untracked.
- Không force-push, không rewrite history và không đưa file môi trường, credential, backup, build output hoặc runtime artifact vào Git.
- Nếu push thất bại, phải báo blocker cùng bằng chứng; không được mô tả dự án là đã đồng bộ Git.
