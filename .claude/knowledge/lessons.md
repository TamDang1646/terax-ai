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

## L-008 | 2026-10-12 | Pipe lệnh dài qua `tail` làm mất mã thoát → báo thành công sai
Chuyện gì: Chạy `pnpm tauri build 2>&1 | tail -60` ở chế độ nền. Harness báo "completed (exit code 0)" nên tôi báo user là build thành công. Thực tế build **thất bại** — log có `[ELIFECYCLE] Command failed with exit code 1` và **không có artifact nào**. Mã thoát harness nhận là của `tail`, không phải của build.
Sai ở đâu: tin mã thoát khi lệnh đã bị pipe. Trong pipeline, `$?` là của lệnh cuối.
Từ nay: **không bao giờ pipe lệnh cần biết kết quả qua `tail`/`head`/`grep`** khi chạy nền. Chạy thẳng (`cmd 2>&1`), hoặc `cmd > log 2>&1; echo "EXIT=$?"`, rồi đọc log bằng Read. Và trước khi báo "xong", **kiểm artifact tồn tại thật** (`ls`), đừng chỉ tin mã thoát.
Nguồn: ticket terminal-ime-preedit (bước build prod)

---

## L-009 | 2026-10-12 | `tauri build` từ chối khi crate Rust lệch minor với gói JS; `tauri dev` thì không
Chuyện gì: `tauri dev` in cảnh báo `Found version mismatched Tauri packages` rồi **chạy tiếp bình thường**. `tauri build` in **đúng cảnh báo đó** nhưng **dừng với exit 1** — không ra artifact nào.
Sai ở đâu: tưởng cảnh báo ở dev là vô hại thì ở build cũng vô hại.
Từ nay: repo này hiện lệch thật (`Cargo.lock` → tauri `2.12.0`, `pnpm-lock.yaml` → `@tauri-apps/api` `2.11.1`; do Dependabot bump nhóm cargo mà không bump gói JS — xem commit `#1324`). Muốn build prod **phải** thêm `--ignore-version-mismatches`, hoặc sửa gốc bằng cách bump gói JS khớp minor. Lệch theo chiều **Rust mới hơn JS** là chiều ít rủi ro hơn (JS chỉ gọi tập lệnh con của Rust), nhưng vẫn là cảnh báo chính thức của Tauri.
Nguồn: ticket terminal-ime-preedit (bước build prod)

---

## L-004 | 2026-10-12 | Ghi file nguồn bằng tool: `\uXXXX` bị giải mã thành ký tự thật
Chuyện gì: Viết `"ế"` vào file test qua Edit/Write. File nhận được **ký tự NFD thật**, không phải chuỗi escape. Hậu quả: NFD và NFC **trông y hệt nhau** trong source (nhất là `U+212A KELVIN SIGN` render giống hệt chữ `K`), nên regex/chuỗi test trở nên không đọc được và dễ bị sửa sai. Riêng `\x1b` thì lại đi qua nguyên vẹn.
Sai ở đâu: tưởng tool ghi literal những gì mình gõ. Thực tế `\u` bị JSON giải mã, `\x` thì không.
Từ nay: cần escape **nằm nguyên trong file** thì viết `\\uXXXX`, hoặc tốt hơn là dùng `String.fromCharCode(0x037e, ...)` cho tường minh. Với fixture NFD/NFC, thêm assertion tự kiểm (`expect(x.normalize("NFC")).not.toBe(x)`) để nếu file bị normalize thì test **đỏ to** chứ không im lặng thành test rỗng. Nếu cần sửa chính xác một dòng đã dính ký tự lạ, dùng `perl -i -pe` thay vì Edit.
Nguồn: ticket terminal-unicode-input

---

## L-005 | 2026-10-12 | Review chạy lâu đọc bản code CŨ HƠN — phải verify lại finding
Chuyện gì: security-reviewer chạy 13 phút. Trong lúc đó code-reviewer vòng 1 trả FAIL và Vorta đã sửa. Security reviewer báo 2 finding MEDIUM (S2: denylist `NAMED_KEYS` thiếu; L2: dedup dùng chuỗi thô) — **cả hai đã được sửa xong trước khi nó đọc file**.
Sai ở đâu: suýt nữa thì sửa lại thứ đã sửa, hoặc báo user là còn tồn.
Từ nay: subagent chạy song song mà mất > vài phút thì finding của nó phải **verify lại bằng grep/đọc code hiện tại** trước khi hành động. Ghi rõ trong báo cáo là "reviewer đọc bản cũ" nếu đúng.
Nguồn: ticket terminal-unicode-input

---

## L-006 | 2026-10-12 | `git commit` hút mọi thứ đã staged sẵn — kiểm index trước
Chuyện gì: `git add` 4 file rồi `git commit`. Commit ra **10 file**, vì `/vorta-init` đã để sẵn 6 file (CLAUDE.md, .claude/*, .gitignore) trong index từ trước phiên. Commit mang tên `fix(terminal)` chứa cả cấu hình.
Sai ở đâu: tin rằng `git add` chỉ định nghĩa cái sẽ commit. Nó **thêm vào** index, không thay thế.
Từ nay: trước mọi `git commit`, chạy `git status --short` và đọc kỹ cột staged. Muốn chắc thì `git commit -- <paths>` hoặc `git reset` index trước. Repo này có sẵn file staged từ `/vorta-init` nên càng phải cẩn thận.
Nguồn: ticket terminal-unicode-input

---

## L-007 | 2026-10-12 | Hai câu trả lời của user mâu thuẫn → dừng, đòi phép thử quyết định
Chuyện gì: User mô tả triệu chứng "chữ chỉ hiện khi Space/Enter". Vorta chẩn đoán là thiếu preedit IME. Nhưng khi hỏi kỹ, user trả lời "cả tiếng Anh cũng phải Space/Enter" — **mâu thuẫn** với câu trả lời trước đó ("chỉ không gõ được ngoài utf-8 english", tức tiếng Anh gõ được). Hai cách đọc dẫn tới **hai bệnh hoàn toàn khác nhau**: thiếu preedit (tầng bộ gõ) so với lỗi đường vẽ/output.
Sai ở đâu: suýt xây phương án nhiều ngày dựa trên một chẩn đoán chưa chắc, chỉ vì nó "khớp nhất".
Từ nay: khi dữ kiện user đưa **tự mâu thuẫn**, không chọn cách đọc nào cả — nêu rõ mâu thuẫn và đưa **một phép thử phân biệt được hai giả thuyết** (ở đây: đổi Input Source sang bàn phím ABC thuần rồi gõ). Phép thử đó mất 30 giây và chốt được chẩn đoán. Rẻ hơn nhiều so với xây sai hướng.
Nguồn: ticket terminal-ime-preedit

---

## L-003 | 2026-10-12 | zsh phá quoting trong lệnh Bash nhiều lớp
Chuyện gì: `grep -rn "['\"]\./$m['\"]"` trong vòng `for` của zsh báo `bad math expression: operand expected`. Và `--include=*.ts` không quote bị `no matches found`.
Sai ở đâu: shell mặc định của phiên là zsh; nó xử lý ngoặc/glob khác bash.
Từ nay: lệnh có quoting lồng hoặc glob trong biến thì bọc `bash -c '...'`; luôn quote pattern `--include='*.ts'`.
Nguồn: ticket terminal-analysis
