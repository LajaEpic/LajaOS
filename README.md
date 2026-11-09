# 🌟 LajaOS - Hệ Điều Hành Quản Lý Đời Sống Cá Nhân (Personal Life OS)

> Ứng dụng web cá nhân giúp quản lý **Kế hoạch & Deadline chuẩn Notion** kết hợp **Quản lý Tài chính & Phân bổ Quỹ chi tiêu** với giao diện **Dark Mode khoa học (Eye-Care Slate)** chống mỏi mắt.
> Hỗ trợ hoạt động linh hoạt: **Cục bộ 100% (Local Offline)** hoặc **Đám Mây (Deploy Render + MongoDB Atlas)** kèm **Tự Động Đồng Bộ 2 Chiều Về Ổ Cứng Máy Tính**.

---

## ⚡ 1. Khởi Động Nhanh Trên Máy Tính Này (1-Click)

Bạn chỉ cần **nhấp đúp chuột (double-click)** vào file:
👉 **`Chay-Ung-Dung.bat`**

Hệ thống sẽ tự động:
1. Tự động kiểm tra và đồng bộ dữ liệu mới nhất từ Cloud về máy (nếu có mạng và đã cấu hình `.env`).
2. Khởi chạy máy chủ cục bộ bằng Node.js tích hợp sẵn (không cần cài đặt gì thêm).
3. Tự động mở trình duyệt web mặc định tại địa chỉ: **`http://localhost:3000`**.

Để tắt ứng dụng, chỉ cần nhấp đúp file: 👉 **`Tat-Ung-Dung.bat`**.

---

## 🚀 2. Hướng Dẫn Triển Khai Lên Render & Đồng Bộ Về Máy Tính

### 🌿 Bước 2.1: Tạo Cơ Sở Dữ Liệu MongoDB Atlas Miễn Phí (M0 Free Forever - 512MB)
1. Truy cập [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas) và đăng ký/đăng nhập bằng Google.
2. Tạo một **Cluster M0 Free** (chọn server gần nhất như Singapore).
3. Vào mục **Database Access** -> Tạo một User & Password (ví dụ: `lajaos_user` / `matkhau123`).
4. Vào mục **Network Access** -> Chọn **Add IP Address** -> Chọn **Allow Access from Anywhere** (`0.0.0.0/0`) để Render có thể kết nối được.
5. Vào **Database** -> Nhấn nút **Connect** -> Chọn **Drivers (Node.js)** -> Copy chuỗi kết nối dạng:
   `mongodb+srv://lajaos_user:matkhau123@cluster0.xxxxx.mongodb.net/lajaos?retryWrites=true&w=majority`

---

### 🐙 Bước 2.2: Đẩy Mã Nguồn Lên GitHub
1. Tạo một repository mới trên GitHub (khuyến khích đặt ở chế độ **Private** để bảo mật dữ liệu cá nhân).
2. Tại thư mục máy tính của bạn, mở Terminal / PowerShell và chạy các lệnh:
   ```bash
   git init
   git add .
   git commit -m "Khoi tao LajaOS"
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
   git push -u origin main
   ```
   *(Thư mục `bin/` chứa file node.exe đã được tự động bỏ qua qua `.gitignore` nên quá trình đẩy lên Git rất nhẹ và nhanh).*

---

### 🌐 Bước 2.3: Triển Khai Lên Render (Web Service Miễn Phí)
1. Đăng nhập vào [https://render.com](https://render.com).
2. Nhấn nút **New +** -> Chọn **Web Service**.
3. Chọn Repository GitHub vừa tạo.
4. Render sẽ tự động nhận diện cấu hình:
   - **Name**: `lajaos` (hoặc tên tùy ý của bạn)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Kéo xuống phần **Environment Variables**, thêm các biến sau:
   - `MONGODB_URI`: Dán chuỗi kết nối MongoDB Atlas đã lấy ở Bước 2.1.
   - `ACCESS_PIN`: Mã PIN bảo vệ (ví dụ: `123456`) - để khi bạn vào link Render trên điện thoại/máy khác thì cần nhập PIN để xem và sửa.
   - `SYNC_SECRET`: Khóa đồng bộ bí mật (ví dụ: `lajaos_secret_key`).
6. Nhấn **Deploy Web Service**.
7. Sau ~1 phút, Render sẽ cấp cho bạn một đường link miễn phí 24/7 dạng:
   `https://lajaos-xxxx.onrender.com`

> **Lưu ý**: Lần đầu tiên Render khởi động kết nối với MongoDB Atlas, hệ thống sẽ **tự động nạp toàn bộ các dự án, nhiệm vụ và quỹ chi tiêu hiện tại từ file `db.json` lên Cloud** mà bạn không cần phải nhập lại bất cứ thứ gì!

---

### 🔄 Bước 2.4: Cấu Hình Đồng Bộ Về Máy Tính Local
Để máy tính này tự động kéo toàn bộ dữ liệu bạn đã sửa từ điện thoại/máy tính khác về máy:
1. Tạo một file `.env` tại thư mục này (dựa theo mẫu `.env.example`).
2. Điền thông tin đường link Render hoặc MongoDB:
   ```env
   REMOTE_URL=https://lajaos-xxxx.onrender.com
   ACCESS_PIN=123456
   SYNC_SECRET=lajaos_secret_key
   ```
   *(Hoặc điền `MONGODB_URI=mongodb+srv://...`)*
3. **Cách đồng bộ**:
   - **Tự động**: Mỗi lần bạn nhấp đúp `Chay-Ung-Dung.bat`, hệ thống sẽ tự động đồng bộ ngay lập tức!
   - **Thủ công 1-Click**: Bất cứ lúc nào, bạn chỉ cần nhấp đúp file 👉 **`Dong-Bo-Du-Lieu.bat`** hoặc bấm nút **"Đồng bộ"** trên thanh tiêu đề của web!

---

## 🎯 3. Các Tính Năng Trọng Tâm

### 📌 A. Phân Hệ Kế Hoạch & Deadline (Planner)
- **Cấu trúc 2 cấp bậc**: Quản lý theo từng **Kế hoạch lớn / Dự án** chứa nhiều **Nhiệm vụ cụ thể con**.
- **Hiển thị Deadline trực quan**:
  - Đầy đủ ngày giờ chính xác.
  - Huy hiệu đếm ngược thông minh: *"Hôm nay lúc 17:00"*, *"Còn 2 ngày"*, *"Quá hạn 1 giờ"* (màu đỏ cảnh báo).
  - 4 cấp độ ưu tiên: **Khẩn cấp (Urgent)**, **Ưu tiên cao (High)**, **Trung bình (Medium)**, **Thấp (Low)**.
  - Sắp xếp linh hoạt theo ngày/giờ hạn chót hoặc mức độ ưu tiên.
- **Bảng Chi Tiết Công Việc Phong Cách Notion (Task Drawer)**:
  - Bấm vào bất kỳ task nào để trượt ra bảng chi tiết từ bên phải màn hình.
  - **Nút Cài Đặt Nhanh (⚙️)**: Sửa trực tiếp Tên nhiệm vụ, Ngày giờ Deadline, Mức ưu tiên và Dự án trực thuộc.
  - **Ghi chú Notion (Markdown)**: Hỗ trợ tiêu đề `#`, checklist `- [ ]`, trích dẫn `>`, in đậm `**`.
  - **Checklist việc con**: Tích chọn hoàn thành và tự động tính % tiến độ trực quan.
  - **Quản lý Link tài liệu**: Lưu danh sách URL, tiêu đề tài liệu và nút mở link một chạm.
  - **File đính kèm**: Kéo thả hoặc chọn file từ máy tính. Khi chạy online trên Render, file được lưu vĩnh viễn trong MongoDB và tự động tải về thư mục `uploads/tasks/` của máy tính này khi đồng bộ!

---

### 💰 B. Phân Hệ Quản Lý Tài Chính (Smart Finance & Calendar)
- **Thiết lập Ngân sách & Phân bổ Quỹ hàng tháng**:
  - Nhập tổng ngân sách tháng.
  - Chia nhỏ vào các **Quỹ chi tiêu** linh hoạt theo % hoặc số tiền cố định.
  - Bảng màu 12 mẫu pastel hiện đại, dễ nhìn.
  - **Thanh ngân sách vơi dần (Depleting Bar)**: Ban đầu thanh hiển thị 100% đầy, khi bạn chi tiêu thanh sẽ vơi dần tương ứng với số tiền còn lại. Tự động chuyển màu vàng cảnh báo khi còn dưới 20% và màu đỏ khi vượt quỹ.
- **Ghi chép chi tiêu chi tiết**:
  - Ghi nhận ngày giờ tiêu tiền chính xác, trừ trực tiếp vào Quỹ chi tiêu tương ứng.
  - Phân loại Tag: `Food`, `Study`, `Invest`, `Entertain`, `Transport`, `Shopping`, `Medical`, `Bills`.
- **Lịch Tài Chính (Calendar View)**:
  - Xem tổng quan ngày, tháng, năm. Mỗi ngày hiển thị số tiền đã tiêu và icon đối soát.
- **Tổng Kết Cuối Ngày (Daily Recap)** & **Biểu đồ tròn Donut (% Tag)**:
  - Xem tỷ trọng chi tiêu từng danh mục, bảng lịch sử giao dịch có tìm kiếm, lọc Tag và nút **Xuất CSV** mở bằng Excel.

---

## 💾 4. Vị Trí Lưu Trữ Dữ Liệu
- **Cơ sở dữ liệu cục bộ**: `data\db.json` (tự động sao lưu tại `data\db.backup.json`).
- **File đính kèm công việc**: `uploads\tasks\`
- **Logo cá nhân**: `public\custom-logo\`
