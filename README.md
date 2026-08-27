# SmartTrip — Hệ thống hoạch định lịch trình du lịch thông minh

Frontend React + Vite hiện thực hoá thiết kế **SmartTrip Organic** (Claude Design,
dự án "SmartTrip UI Mockups"), lấy cảm hứng từ Wanderlog.

## Chạy dự án

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build production vào dist/
```

## Màn hình

| Màn hình | Nội dung |
|---|---|
| Đăng nhập / Đăng ký | Form auth song ngữ Việt–Nhật/Anh (mock, bấm là vào) |
| Chuyến đi của tôi | Danh sách chuyến đi dạng card |
| Chi tiết chuyến đi | 3 tab: **Lịch trình & bản đồ**, **Ngân sách & chia tiền**, **Thành viên** |
| Trợ lý AI | Form soạn lịch trình → loading → bản nháp 4 ngày |
| Bản mobile | Khung iPhone (iOS 26) với 2 tab Lịch trình / Bản đồ |

## Ngôn ngữ thiết kế

Hệ "Organic" của bản mockup được giữ nguyên (nền giấy kem, đất nung `#c67139`, rêu `#7a8a5e`,
chữ Caprasimo + Figtree) và dựng thêm một lớp giao diện lấy ý niệm **sổ tay du ký**:

- **Chất liệu** — lớp vân giấy phủ toàn trang, ánh sáng ấm toả từ hai góc, bóng đổ ám nâu
  theo một nguồn sáng duy nhất thay vì đen trong suốt.
- **Ảnh** — mỗi chuyến đi và mỗi màn hero có một "phiến ảnh": ảnh thật nằm trên nền gradient
  kèm vân đường đồng mức kiểu bản đồ, nên khi ảnh chậm hoặc bị chặn thì khung vẫn ra dáng chủ đích.
- **Bố cục** — bỏ lưới ba cột đều nhau; chuyến gần nhất là thẻ lớn nằm ngang, hai chuyến còn lại
  nhỏ hơn bên dưới. Lịch trình dựng thành đường thời gian có trục nối các mốc.
- **Chuyển động** — các mục vào màn theo bậc, nhưng chỉ là lớp phủ thêm: trạng thái nghỉ luôn
  hiển thị, kèm lưới an toàn ép hiện sau 1.1s để nội dung không bao giờ kẹt vô hình.
- **Trạng thái** — màn chờ AI là skeleton đúng hình khối kết quả (không phải vòng xoay),
  form có báo lỗi tại chỗ, bảng chi có empty state.

## Tính năng đã có

- **Lịch trình theo ngày** — kéo-thả sắp xếp lại điểm dừng, nút **Tối ưu tuyến đường**
  (nearest-neighbour), chạm một điểm dừng để định vị ghim trên bản đồ.
- **Bản đồ Leaflet + OpenStreetMap** phủ màu giấy ấm theo design system; ghim tròn đánh số,
  tuyến đường nét đứt màu đất nung; tự fallback sang mirror / nền chấm khi tile không tải được.
- **Ngân sách** — bảng khoản chi, thêm khoản chi (dialog), thanh tiến độ so với kế hoạch,
  số dư từng người sau chia đều, và **tất toán gọn nhất** (greedy, n−1 giao dịch), đánh dấu đã trả.
- **Thành viên & quyền** — Chủ chuyến đi / Sửa / Xem, mời qua email (thêm trạng thái
  "Chờ phản hồi"), chia sẻ liên kết + sao chép.
- **Phụ đề tiếng Anh** bật/tắt (nút `EN` trên nav) — hỗ trợ khách quốc tế.
- Dữ liệu chuyến đi (lịch, khoản chi, thành viên) lưu **localStorage**.

## Cấu trúc

```
src/
  organic.css          # design system "Organic" (token + component classes)
  data.js              # seed data chuyến Đà Nẵng – Hội An
  store.jsx            # AppProvider (state + persist) & computeBudget
  App.jsx              # nav + điều hướng màn hình
  components/          # ui.jsx (Seg, Avatar, icons), MapView, IOSDevice, ExpenseDialog
  screens/             # Login, Trips, Trip (+ trip/ItineraryTab|BudgetTab|MembersTab), AIDesk, Mobile
```

## Bước tiếp theo (theo spec)

1. **Firebase**: Auth (Google/Email), Firestore theo mô hình `trips/{tripId}/days/{dayId}/stops`,
   realtime listeners cho cộng tác nhóm, Security Rules theo `memberIds`.
2. **Tìm kiếm địa điểm**: Google Places hoặc **Goong API** để thêm điểm dừng thật.
3. **Directions API** (Google/Goong) thay cho tối ưu nearest-neighbour hiện tại.
4. **Gemini/Claude API** cho Trợ lý AI sinh lịch trình thật thay vì bản nháp mock.
5. Xuất PDF, đa ngôn ngữ đầy đủ (i18n Việt–Nhật), app Flutter đồng bộ Firebase.
