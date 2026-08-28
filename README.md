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
| Đăng nhập / Đăng ký | Firebase Auth: Google + Email/Password (chế độ thử khi chưa nối Firebase) |
| Chuyến đi của tôi | Danh sách chuyến đi dạng card, tìm kiếm & lọc theo trạng thái, tạo chuyến trống |
| Chi tiết chuyến đi | 3 tab: **Lịch trình & bản đồ**, **Ngân sách & chia tiền**, **Thành viên** |
| Trợ lý AI | Form soạn lịch trình → loading → bản nháp đúng số ngày đã chọn |

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
- **Tìm kiếm & lọc chuyến đi** trên màn Chuyến đi (theo từ khoá và trạng thái).
- **Toast thông báo** khi tối ưu tuyến, ghi khoản chi, sao chép liên kết, gửi lời mời.
- **Đăng nhập thật** bằng Firebase Auth (Google, Email/Password); mỗi người chỉ thấy chuyến đi
  mình là thành viên.
- **Đồng bộ realtime** qua Firestore — người khác sửa lịch trình hay thêm khoản chi thì màn hình
  của bạn tự cập nhật, không cần tải lại.
- **Trợ lý AI thật** bằng Firebase AI Logic (Gemini) với structured output, tạo được chuyến đi
  mới thẳng từ bản nháp.
- Mọi thứ đọc từ backend đều đi qua bộ kiểm tra shape, nên dữ liệu hỏng không làm sập app;
  khi chưa nối Firebase thì dùng localStorage (`smarttrip-v2`).

## Nối Firebase

> **Trạng thái:** dự án đã nối vào project `nihon-speaking-29442-5f1db`.
> `.firebaserc` đã trỏ sẵn; Security Rules đã deploy; web app `SmartTrip` đã đăng ký.
> Chỉ cần `cp .env.example .env.local` rồi điền config (hoặc chạy
> `npx firebase apps:sdkconfig WEB`) là chạy được — `.env.local` không nằm trong git.

App vẫn chạy được khi không có Firebase: thiếu cấu hình thì vào **chế độ thử**, dùng
tài khoản giả và lưu dữ liệu trong localStorage. Nối Firebase để có đăng nhập thật,
đồng bộ realtime giữa các thành viên, và Trợ lý AI gọi Gemini thật.

### 1. Tạo project

1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started**, bật hai phương thức:
   **Email/Password** và **Google**.
3. **Build → Firestore Database → Create database** (chọn region gần, ví dụ `asia-southeast1`).
4. **Project settings → Your apps → Web** → đăng ký app, copy đoạn `firebaseConfig`.

### 2. Điền cấu hình

```bash
cp .env.example .env.local
```

Điền các giá trị từ `firebaseConfig` vào `.env.local`, rồi chạy lại `npm run dev`.
Màn đăng nhập sẽ hết dòng "Chế độ thử".

Đây là cấu hình công khai của client, không phải khoá bí mật — Firestore được bảo vệ
bằng Security Rules chứ không phải bằng việc giấu config.

### 3. Nạp Security Rules

```bash
npx firebase deploy --only firestore:rules
```

Rules nằm trong [`firestore.rules`](firestore.rules). Cơ chế: quyền đọc/ghi tra từ hai
trường `memberIds` và `roles` được nhân bản sẵn trên document chuyến đi, nên rule không
phải đọc thêm document nào. Đổi lại, người có quyền Sửa bị cấm sờ vào chính hai trường
đó — chỉ chủ chuyến đi mới đổi được quyền.

Có sẵn bộ test chạy trên emulator:

```bash
npm run test:rules
```

⚠️ Bộ test này **chưa từng chạy được**: `firebase emulators` đòi JDK 21, máy đang có
JDK 17. Rules hiện đã deploy và đã xác nhận chặn được truy cập vô danh (đọc `trips/`
không kèm token trả về HTTP 403), nhưng các nhánh còn lại — editor tự nâng quyền,
editor tự thêm ghế thành viên — mới chỉ đúng trên giấy. Cài JDK 21 rồi chạy lệnh trên
trước khi mở app cho người ngoài dùng.

### 4. Bật Firebase AI Logic (Trợ lý AI)

**Build → AI Logic → Get started**, chọn backend **Gemini Developer API**. Firebase sẽ
tự bật API và tạo khoá phía server — client không giữ khoá Gemini nào.

#### Bật App Check (bắt buộc cho AI Logic)

Firebase **từ chối phục vụ AI Logic cho project chưa enforce App Check** — lỗi trả về là
`403 ... you must enforce Firebase App Check`. Auth và Firestore vẫn chạy bình thường,
chỉ Trợ lý AI bị khoá.

1. **Build → App Check → Apps** → chọn app web `SmartTrip` → **reCAPTCHA v3** →
   đăng ký, copy **site key**.
2. Điền vào `.env.local`:
   ```
   VITE_FIREBASE_APPCHECK_SITE_KEY=<site key>
   ```
   (Nếu bạn chọn reCAPTCHA Enterprise thì thêm `VITE_FIREBASE_APPCHECK_ENTERPRISE=true`.)
3. Chạy `npm run dev`, mở Console trình duyệt: ở chế độ dev app tự bật debug token và in ra
   một chuỗi UUID. Copy nó vào **App Check → Apps → ⋮ → Manage debug tokens**, nếu không
   thì localhost sẽ bị chặn.
4. **App Check → APIs** → bật **Enforce** cho *Firebase AI Logic*.

Code khởi tạo App Check nằm trong [`src/backend/firebase.js`](src/backend/firebase.js), chạy
ngay sau `initializeApp` để Auth và Firestore cũng gửi kèm token — nếu sau này bạn enforce
App Check cho cả hai dịch vụ đó thì không phải sửa gì thêm. Không điền site key thì App Check
không bật, mọi thứ khác vẫn chạy như cũ.

Model mặc định là `gemini-3.5-flash`, đổi bằng `VITE_GEMINI_MODEL` trong `.env.local`.

Trợ lý dùng **structured output**: schema JSON được gửi kèm request nên câu trả lời về
đúng khuôn, không phải bóc tách chuỗi. Mọi thứ model trả về vẫn đi qua đúng bộ lọc
`cleanStop` như dữ liệu đọc từ Firestore trước khi được đưa vào mô hình chuyến đi.

### 5. Deploy (tuỳ chọn)

```bash
npm run build
npx firebase deploy --only hosting
```

## Mô hình dữ liệu

Mọi thực thể đều có `id` ổn định; khoản chi trỏ tới người ứng bằng `payerId` chứ không phải
chỉ số mảng, nên xoá hoặc sắp xếp lại thành viên không bao giờ gán nhầm tiền cho người khác.

```
trips/{tripId}
  title, seed, alt, body, startDate, endDate, plan, settled{}, ownerId, createdAt
  members[]  { id, name, email, role, pending, uid }   // role: owner | edit | view
  memberIds[]  roles{}                                 // nhân bản từ members, dành cho Security Rules
trips/{tripId}/days/{dayId}
  place, seed, order, items[] { id, time, name, note, cost, lat, lng }   // lat/lng có thể null
trips/{tripId}/expenses/{expenseId}
  name, cat, payerId, amount, createdAt

settled { "<fromId>><toId>:<số tiền>": true }   // khoá kèm số tiền: khoản chi đổi ⇒ dấu "đã trả" hết hiệu lực
```

Điểm dừng nằm **trong** document ngày chứ không phải subcollection riêng: mọi thao tác sửa
điểm dừng (kéo-thả, tối ưu tuyến) đều ghi lại cả ngày, nên tách ra sẽ biến một lần ghi thành
N lần. Ngược lại khoản chi có document riêng vì đó mới là chỗ nhiều người cùng thêm một lúc,
và ghi theo từng document thì họ không đè lên nhau.

Những con số như số điểm dừng, tổng chi, trạng thái chuyến (Nháp / Sắp tới / Đã đi),
"khởi hành sau N ngày" đều **tính từ dữ liệu**, không lưu sẵn, nên không bao giờ lệch.

## Cấu trúc

```
src/
  organic.css          # design system "Organic" (token + component classes)
  data.js              # seed 3 chuyến + helper ngày tháng, tiền tệ, factory
  store.jsx            # AppProvider (session + state + actions), computeBudget, settleKey
  App.jsx              # nav + điều hướng màn hình
  backend/
    config.js          # đọc biến môi trường, cờ firebaseEnabled
    firebase.js        # khởi tạo app/auth/db/ai (lazy)
    auth.js            # đăng nhập/đăng ký/đăng xuất + thông báo lỗi tiếng Việt
    schema.js          # kiểm tra và vá shape mọi dữ liệu đọc từ ngoài vào
    firestore.js       # repository chạy trên Firestore
    local.js           # repository chạy trên localStorage (chế độ thử)
    ai.js              # sinh lịch trình bằng Firebase AI Logic (hoặc mock)
    index.js           # chọn repository theo cấu hình
  components/          # ui.jsx (Seg, Avatar, icons), MapView, ExpenseDialog, ErrorBoundary, useFieldDraft
  screens/             # Login, Trips, Trip (+ trip/ItineraryTab|BudgetTab|MembersTab), AIDesk
tests/
  firestore-rules.test.mjs   # kiểm thử Security Rules trên emulator
firestore.rules        # ai đọc được gì, ai ghi được gì
firebase.json          # rules, hosting, cổng emulator
```

`screens/` không bao giờ gọi thẳng Firestore. Nó gọi `actions` trên store, store gọi
repository, và repository có hai bản cài đặt cùng một giao diện — Firestore hoặc localStorage.
Nhờ vậy chế độ thử không phải là nhánh `if` rải khắp giao diện.

## Bước tiếp theo (theo spec)

1. ~~Firebase Auth + Firestore + Security Rules~~ — xong, xem mục **Nối Firebase**.
2. ~~Gemini cho Trợ lý AI~~ — xong, qua Firebase AI Logic.
3. **Tìm kiếm địa điểm**: Google Places hoặc **Goong API** để điểm dừng thêm tay có toạ độ thật.
4. **Directions API** (Google/Goong) thay cho tối ưu nearest-neighbour hiện tại.
5. Xuất PDF, i18n đầy đủ, app Flutter đồng bộ Firebase.

## Còn nợ

- **Lời mời mới chỉ ghi vào chuyến đi**, chưa gửi email và người được mời chưa tự nhận được
  quyền khi đăng nhập. Cần một Cloud Function đối chiếu email với tài khoản rồi điền `uid`
  vào chỗ ngồi tương ứng — chừng nào chưa có thì họ vẫn chưa đọc được chuyến đi.
- Liên kết chia sẻ `/t/{tripId}` chưa có route xử lý; app hiện chưa có router.
- Chưa có xoá thành viên và chưa có luồng huỷ lời mời.
- Kéo-thả dùng HTML5 drag & drop nên chưa chạy trên cảm ứng, và chưa có cách sắp xếp bằng bàn phím.
- Ngoài bộ test Security Rules thì chưa có test nào khác, cũng chưa có lint hay CI.
