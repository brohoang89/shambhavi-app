# HƯỚNG DẪN CÀO TOÀN BỘ COMMENT YOUTUBE (0Đ, CHẠY LOCAL)

Hướng dẫn này giúp bạn cào **toàn bộ comment top-level và reply** của 1 video
YouTube, sắp xếp mới nhất trước, có khả năng **resume** khi hết quota mà
không lặp dữ liệu. Chi phí: **0 đồng**.

---

## PHẦN 1: CHUẨN BỊ MÔI TRƯỜNG

### Bước 1.1 — Cài Python

1. Vào https://www.python.org/downloads/
2. Tải bản Python mới nhất (khuyến nghị 3.10 trở lên) cho hệ điều hành của bạn.
3. Khi cài trên Windows, **nhớ tick vào ô "Add Python to PATH"** trước khi bấm Install.
4. Kiểm tra đã cài thành công: mở Command Prompt (Windows) hoặc Terminal
   (Mac/Linux), gõ:
   ```
   python --version
   ```
   Nếu hiện ra số phiên bản (vd: `Python 3.12.1`) là thành công.
   (Trên Mac/Linux đôi khi cần gõ `python3` thay vì `python`.)

### Bước 1.2 — Tạo API Key trên Google Cloud (miễn phí)

1. Vào https://console.cloud.google.com/
2. Đăng nhập bằng tài khoản Google bất kỳ.
3. Góc trên bên trái → **"Select a project"** → **"New Project"** → đặt tên
   tùy ý (vd: `youtube-comment-tool`) → **Create**.
4. Đảm bảo project vừa tạo đang được chọn (xem ở góc trên).
5. Vào menu (☰) → **APIs & Services** → **Library**.
6. Gõ tìm **"YouTube Data API v3"** → bấm vào kết quả → bấm **Enable**.
7. Vào **APIs & Services** → **Credentials** → **Create Credentials** →
   **API key**.
8. Copy đoạn API key (dạng `AIzaSy...`) → lưu lại cẩn thận, sẽ dùng nhiều lần.
9. *(Khuyến nghị bảo mật)* Bấm vào key vừa tạo → mục **API restrictions** →
   chọn **Restrict key** → tick **YouTube Data API v3** → **Save**. Việc này
   giúp nếu lỡ lộ key, người khác cũng không dùng được cho việc khác.

> **Quota miễn phí:** mỗi project được cấp **10.000 unit/ngày**, reset vào
> khoảng nửa đêm giờ Thái Bình Dương (~14h-15h chiều giờ Việt Nam, tùy mùa).
> Mỗi lượt gọi lấy comment (top hoặc reply) tốn đúng 1 unit — đủ cho hàng
> trăm nghìn comment/ngày với hầu hết video.

### Bước 1.3 — Cài thư viện Python cần thiết

Mở Command Prompt/Terminal, gõ:
```
pip install google-api-python-client
```
Đợi cài xong (thường vài chục giây).

---

## PHẦN 2: TẢI SCRIPT VÀ CHẠY

### Bước 2.1 — Tải file script

Tải file **`cao_comment_resume.py`** về máy (đây là bản đầy đủ nhất, có cơ
chế resume khi hết quota — nên dùng bản này thay vì các bản trước đó).

Đặt file vào 1 thư mục riêng, ví dụ: `C:\cao-comment\` (Windows) hoặc
`~/cao-comment/` (Mac/Linux). Toàn bộ file kết quả sẽ được lưu cùng thư mục
với script.

### Bước 2.2 — Lấy link video muốn cào

Vào YouTube, mở video cần lấy comment, copy link trên thanh địa chỉ trình
duyệt. Dạng phổ biến:
```
https://www.youtube.com/watch?v=XXXXXXXXXXX
```

### Bước 2.3 — Chạy script

Mở Command Prompt/Terminal, di chuyển vào đúng thư mục chứa script:
```
cd C:\cao-comment
```
(hoặc `cd ~/cao-comment` trên Mac/Linux)

Chạy lệnh:
```
python cao_comment_resume.py
```

Chương trình sẽ hỏi lần lượt:
```
Nhập API key: <dán API key bạn đã tạo ở Bước 1.2>
Dan link video YouTube: <dán link video>
```

Sau đó chương trình tự động chạy, in tiến độ liên tục, ví dụ:
```
Bat dau cao MOI cho video: dQw4w9WgXcQ
Da xu ly 50 comment top (32 reply)...
Da xu ly 100 comment top (78 reply)...
...
```

### Bước 2.4 — Khi chạy xong hoàn toàn

Bạn sẽ thấy:
```
=== HOAN TAT TOAN BO ===
Tong comment top: ...
Tong reply: ...
Tong cong: ...
File cay (JSON): comments_tree_XXXXXXXXXXX.json
File phang (CSV): comments_flat_XXXXXXXXXXX.csv
```

Mở file `.csv` bằng Excel/Google Sheets để xem dạng bảng, hoặc mở file
`.json` nếu muốn dùng cấu trúc cây (comment top kèm sẵn danh sách reply)
cho việc lập trình/phân tích thêm.

---

## PHẦN 3: KHI BỊ HẾT QUOTA GIỮA CHỪNG

Nếu đang chạy mà thấy dòng:
```
[HET QUOTA] Da luu vi tri dung. Chay lai script sau (vd: ngay mai khi
quota duoc reset) de tiep tuc dung cho, khong mat va khong lap du lieu.
```

→ Không cần làm gì thêm. Bạn chỉ cần:
1. Đợi đến hôm sau (hoặc khi quota được reset).
2. Chạy lại **đúng lệnh cũ**: `python cao_comment_resume.py`
3. Nhập lại **API key** và **đúng link video đó**.
4. Chương trình sẽ tự nhận ra đã có tiến trình dở dang (nhờ file
   `checkpoint_<video_id>.json` nằm cùng thư mục) và tiếp tục chính xác từ
   chỗ dừng — không cào lại từ đầu, không ghi trùng dữ liệu.

**Quan trọng:** đừng xóa hay đổi tên các file `checkpoint_*.json`,
`comments_raw_*.jsonl`, `comments_flat_*.csv` giữa các lần chạy — chúng
chính là "trí nhớ" giúp chương trình biết đã cào đến đâu.

Nếu muốn **cào lại từ đầu** (bỏ hết tiến trình cũ), xóa 3 file trên rồi
chạy lại script.

---

## PHẦN 4: CẤU TRÚC DỮ LIỆU ĐẦU RA

### File CSV (`comments_flat_<video_id>.csv`) — dạng bảng phẳng

| Cột | Ý nghĩa |
|---|---|
| `id` | ID của comment (top) hoặc reply |
| `parent_id` | Rỗng nếu là comment top; có giá trị = ID của comment top nếu đây là reply |
| `author` | Tên người bình luận |
| `text` | Nội dung |
| `like_count` | Số lượt thích |
| `published_at` | Thời gian đăng |
| `updated_at` | Thời gian chỉnh sửa gần nhất (nếu có) |
| `total_reply_count` | Chỉ có giá trị ở dòng comment top — tổng số reply của nó |

### File JSON (`comments_tree_<video_id>.json`) — dạng cây

```json
[
  {
    "comment_id": "Ugx...",
    "author": "Nguyen Van A",
    "text": "Video hay quá!",
    "like_count": 120,
    "published_at": "2026-07-18T10:00:00Z",
    "total_reply_count": 2,
    "replies": [
      {
        "reply_id": "Ugx...abc",
        "parent_id": "Ugx...",
        "author": "Tran Thi B",
        "text": "Đồng ý!",
        "like_count": 5,
        "published_at": "2026-07-18T10:05:00Z"
      }
    ]
  }
]
```

---

## PHẦN 5: NHỮNG LƯU Ý QUAN TRỌNG

1. **Tối ưu quota đã được tích hợp sẵn:** script luôn lấy tối đa 100
   comment/lượt gọi, và chỉ gọi thêm API lấy reply khi số reply thật
   (`totalReplyCount`) nhiều hơn số reply được trả kèm sẵn — không lãng
   phí quota cho comment ít/không có reply.

2. **Reply dù nhiều đến đâu (60, 200, 600...) đều được lấy đủ**, nhờ vòng
   lặp phân trang riêng cho từng comment có nhiều reply, có resume đúng
   giữa chừng nếu bị ngắt khi đang lấy dở 1 thread reply dài.

3. **Sắp xếp mới nhất trước** (`order="time"`) — đây là chiều duy nhất
   YouTube API hỗ trợ (không có tùy chọn cũ nhất trước). Nếu có comment
   mới phát sinh giữa các lần chạy cách nhau, script tự động **loại
   trùng** theo ID khi hoàn tất, nên kết quả cuối cùng không bị lặp.

4. **Video tắt bình luận:** script sẽ tự phát hiện và dừng với thông báo
   rõ ràng, không báo lỗi khó hiểu.

5. **Dừng thủ công bất cứ lúc nào:** nhấn `Ctrl+C`, tiến trình vẫn được
   lưu an toàn (checkpoint được ghi liên tục sau mỗi bước nhỏ).

6. **Video cực nhiều comment** (hàng trăm nghìn - hàng triệu): quá trình
   có thể cần chạy qua nhiều ngày do giới hạn quota — đây là điều bình
   thường, cứ để script tự resume mỗi ngày cho đến khi hoàn tất.

---

## PHẦN 6: XỬ LÝ LỖI THƯỜNG GẶP

| Lỗi gặp phải | Nguyên nhân & cách xử lý |
|---|---|
| `Chua cai thu vien...` | Chạy lại `pip install google-api-python-client` |
| `Khong nhan dien duoc video ID` | Kiểm tra lại link video đã copy đúng chưa, thử dùng dạng `https://www.youtube.com/watch?v=...` |
| `Video nay da tat binh luan` | Video đó không cho bình luận, không cào được |
| Báo lỗi 403 nhưng không phải hết quota (vd: `commentsDisabled`, `keyInvalid`) | Kiểm tra lại API key đã copy đúng chưa, đã bật "YouTube Data API v3" cho project chưa |
| Chạy xong nhưng số liệu ít hơn số comment hiển thị trên YouTube | Bình thường — vì YouTube ẩn bớt comment bị coi là spam/giữ để duyệt, API cũng không trả về những comment đó |

---

Nếu trong quá trình làm theo mà gặp lỗi cụ thể nào, cứ gửi lại nguyên văn
thông báo lỗi, sẽ được hỗ trợ xử lý tiếp.
