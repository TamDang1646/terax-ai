# Lessons

Vorta đọc file này TRƯỚC mỗi ticket mới. Chỉ ghi điều **không** suy ra được từ code hoặc git history.

Ghi khi: đoán sai và trả giá · user sửa cách làm · phát hiện cạm bẫy của dự án · quy ước ngầm không có trong docs.

Không ghi: cấu trúc code (đọc code ra) · lịch sử fix (git ra) · thứ chỉ đúng cho một ticket.

---

## L-001 | 2026-10-12 | Claim "code chết" từ subagent phải tự verify
Chuyện gì: Nhánh khảo sát (explorer) báo 4 file trong `src/modules/terminal/lib/` là orphan vì "chỉ được import bởi chính `.test.ts` của chúng": `keymap.ts`, `cursorBlink.ts`, `terminalPaste.ts`, `terminalLinks.ts`.
Sai ở đâu: grep của subagent khớp **tên symbol** (`keymap`) chứ không phải **đường dẫn module** (`@/modules/terminal/lib/keymap`), nên bỏ sót consumer. Thực tế `keymap.ts` được `ghostty/input/GhosttyInputController.ts:1` dùng. Ngoài ra `terminal/lib/terminalLinks.ts` và `ghostty/core/terminalLinks.ts` là **hai file khác nhau cùng tên** — dễ xoá nhầm file còn sống. Vorta đã verify lại nên không xoá sai.
Từ nay: mọi claim "dead code / orphan / không ai dùng" từ subagent phải tự verify trước khi hành động, bằng grep **đường dẫn import đầy đủ** (cả `@/...` lẫn `./...`), loại trừ file test của chính nó. Pattern dùng được: `grep -rnE "from [\"'][^\"']*[/.]<tên>[\"']" src` rồi lọc bỏ `/<tên>.ts:`.
Nguồn: ticket terminal-analysis, `analysis.md` §7.1

---

## L-002 | 2026-10-12 | Lệnh Bash có `--name-only` bị hook chặn ở repo này
Chuyện gì: `git log --name-only --pretty=format: ...` trả về `clean — nothing to commit` thay vì danh sách file. Chạy lại vẫn vậy. Cùng lệnh với `--numstat` thì chạy bình thường.
Sai ở đâu: tưởng lệnh sai cú pháp, mất 3 lượt thử lại.
Từ nay: cần churn theo file thì dùng `git log --numstat ... > /tmp/x.txt` rồi `awk` gộp, đừng dùng `--name-only`. Gặp output lạ kiểu `clean — nothing to commit` thì đổi cờ, đừng thử lại y nguyên.
Nguồn: ticket terminal-analysis

---

## L-003 | 2026-10-12 | zsh phá quoting trong lệnh Bash nhiều lớp
Chuyện gì: `grep -rn "['\"]\./$m['\"]"` trong vòng `for` của zsh báo `bad math expression: operand expected`. Và `--include=*.ts` không quote bị `no matches found`.
Sai ở đâu: shell mặc định của phiên là zsh; nó xử lý ngoặc/glob khác bash.
Từ nay: lệnh có quoting lồng hoặc glob trong biến thì bọc `bash -c '...'`; luôn quote pattern `--include='*.ts'`.
Nguồn: ticket terminal-analysis
