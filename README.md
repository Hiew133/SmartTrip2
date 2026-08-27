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
| Đăng nhập / Đăng ký | Form auth tiếng Việt kèm phụ đề tiếng Anh (mock, bấm là vào) |
| Chuyến đi của tôi | Danh sách chuyến đi dạng card, tạo chuyến trống |
| Chi tiết chuyến đi | 3 tab: **Lịch trình & bản đồ**, **Ngân sách & chia tiền**, **Thành viên** |
| Trợ lý AI | Form soạn lịch trình → loading → bản nháp đúng số ngày đã chọn |
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
  form có báo lỗi tại chỗ, mọi danh sách rỗng đều có empty state, và lỗi hiển thị rơi vào
  một màn khôi phục có nút xoá dữ liệu hỏng thay vì trang trắng.

## Tính năng đã có

- **Nhiều chuyến đi** — mỗi chuyến có lịch trình, khoản chi, thành viên và ngân sách riêng;
  tạo chuyến trống rồi thêm ngày, thêm điểm dừng, đặt ngày đi/ngày về ngay trong tab Lịch trình.
- **Lịch trình theo ngày** — kéo-thả sắp xếp lại điểm dừng, nút **Tối ưu tuyến đường**
  (nearest-neighbour). Mỗi điểm dừng giữ nguyên giờ của chính nó khi đổi thứ tự, kèm
  **hoàn tác** một bước và gợi ý "sắp lại theo giờ" khi thứ tự lệch khỏi giờ đã ghi.
- **Bản đồ Leaflet + OpenStreetMap** phủ màu giấy ấm theo design system; ghim tròn đánh số,
  tuyến đường nét đứt màu đất nung; tự fallback sang mirror / nền chấm khi tile không tải được.
  Điểm dừng chưa có toạ độ được nói rõ là chưa hiện trên bản đồ.
- **Ngân sách** — bảng khoản chi (thêm / sửa / xoá), ngân sách kế hoạch sửa được, thanh tiến độ,
  số dư từng người sau chia đều, và **tất toán gọn nhất** (greedy — thường n−1 giao dịch,
  không đảm bảo tối thiểu tuyệt đối), đánh dấu đã trả.
- **Thành viên & quyền** — Chủ chuyến đi / Sửa / Xem, mời qua email (thêm trạng thái
  "Chờ phản hồi"), chia sẻ liên kết + sao chép (báo lỗi thật khi trình duyệt chặn clipboard).
- **Phụ đề tiếng Anh** bật/tắt (nút `EN` trên nav) — hỗ trợ khách quốc tế.
- Dữ liệu chuyến đi lưu **localStorage** (`smarttrip-v2`), có kiểm tra và vá lại shape khi đọc
  nên dữ liệu hỏng không làm sập app.

## Mô hình dữ liệu

Mọi thực thể đều có `id` ổn định; khoản chi trỏ tới người ứng bằng `payerId` chứ không phải
chỉ số mảng, nên xoá hoặc sắp xếp lại thành viên không bao giờ gán nhầm tiền cho người khác.

```
trip { id, title, seed, alt, body, startDate, endDate, plan, days[], expenses[], members[], settled{} }
  day     { id, place, seed, items[] }
  stop    { id, time, name, note, cost, lat, lng }     // lat/lng có thể null
  member  { id, name, email, role, pending }           // role: owner | edit | view
  expense { id, name, cat, payerId, amount }
  settled { "<fromId>><toId>:<số tiền>": true }        // khoá kèm số tiền: khoản chi đổi ⇒ dấu "đã trả" hết hiệu lực
```

Những con số như số điểm dừng, tổng chi, trạng thái chuyến (Nháp / Sắp tới / Đã đi),
"khởi hành sau N ngày" đều **tính từ dữ liệu**, không lưu sẵn, nên không bao giờ lệch.

## Cấu trúc

```
src/
  organic.css          # design system "Organic" (token + component classes)
  data.js              # seed 3 chuyến + helper ngày tháng, tiền tệ, factory
  store.jsx            # AppProvider (state + persist + validate), computeBudget, settleKey
  App.jsx              # nav + điều hướng màn hình
  components/          # ui.jsx (Seg, Avatar, icons), MapView, IOSDevice, ExpenseDialog, ErrorBoundary
  screens/             # Login, Trips, Trip (+ trip/ItineraryTab|BudgetTab|MembersTab), AIDesk, Mobile
```

## Bước tiếp theo (theo spec)

1. **Firebase**: Auth (Google/Email), Firestore theo mô hình `trips/{tripId}/days/{dayId}/stops`,
   realtime listeners cho cộng tác nhóm, Security Rules theo `memberIds`.
2. **Tìm kiếm địa điểm**: Google Places hoặc **Goong API** để điểm dừng thêm tay có toạ độ thật.
3. **Directions API** (Google/Goong) thay cho tối ưu nearest-neighbour hiện tại.
4. **Gemini/Claude API** cho Trợ lý AI sinh lịch trình thật thay vì bản nháp mock.
5. Xuất PDF, i18n đầy đủ, app Flutter đồng bộ Firebase.

## Còn nợ

- Kéo-thả dùng HTML5 drag & drop nên chưa chạy trên cảm ứng, và chưa có cách sắp xếp bằng bàn phím.
- Chưa có xoá thành viên và chưa có luồng chấp nhận/huỷ lời mời đang "Chờ phản hồi".
- Chưa có test, lint hay CI.
