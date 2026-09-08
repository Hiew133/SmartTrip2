# SmartTrip — Hệ thống hoạch định lịch trình du lịch thông minh

Frontend React + Vite hiện thực hoá thiết kế **SmartTrip Organic** (Claude Design,
dự án "SmartTrip UI Mockups"), lấy cảm hứng từ Wanderlog.

## Chạy dự án

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build production vào dist/
npm run lint       # eslint — phải 0 lỗi trước khi commit
npm test           # test logic thuần, chạy trong vài giây, không cần gì thêm
npm run test:rules # test Security Rules trên emulator (cần JDK 21+)
```

## Màn hình

| Màn hình | Nội dung |
|---|---|
| Đăng nhập / Đăng ký | Firebase Auth: Google + Email/Password (chế độ thử khi chưa nối Firebase) |
| Chuyến đi của tôi | Danh sách chuyến đi dạng card, tìm kiếm & lọc theo trạng thái, tạo chuyến trống |
| Chi tiết chuyến đi | 5 tab: **Lịch trình & bản đồ**, **Trợ lý AI**, **Ngân sách & chia tiền**, **Thành viên**, **Cẩm nang bản địa** |
| Dịch | Sổ tay dịch: gõ câu tiếng Việt, đưa màn hình cho người bản địa đọc |
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
- **Lịch trình theo ngày** — sắp xếp lại điểm dừng bằng nút **↑ ↓** (chạy trên cả cảm ứng
  và bàn phím) hoặc kéo-thả, đổi thứ tự cả ngày, và nút **Tối ưu tuyến đường**
  (nearest-neighbour trên **khoảng cách đường bộ** khi có khoá Goong, haversine khi không —
  toast nói rõ vừa dùng cái nào, vì hai kết quả nhìn bằng mắt giống hệt nhau). Mỗi điểm
  dừng giữ nguyên giờ của chính nó khi đổi thứ tự, kèm **hoàn tác** một bước và gợi ý
  "sắp lại theo giờ" khi thứ tự lệch khỏi giờ đã ghi. Mỗi ngày hiện quãng đường tính bằng km.
- **Tìm kiếm địa điểm** ngay trong ô tên điểm dừng — chọn một gợi ý là điểm dừng có toạ độ
  thật và lên bản đồ. Mặc định dùng Nominatim (OpenStreetMap), không cần đăng ký gì;
  điền `VITE_GOONG_API_KEY` để đổi sang Goong, sát với địa chỉ Việt Nam hơn.
- **Bản đồ Leaflet** phủ màu giấy ấm theo design system; ghim tròn đánh số, tuyến đường màu
  đất nung; tự fallback sang mirror / nền chấm khi tile không tải được. Điểm dừng chưa có
  toạ độ được nói rõ là chưa hiện trên bản đồ.
- **Bản đồ nền Goong** khi có `VITE_GOONG_MAPTILES_KEY` — vector tile qua MapLibre, biết tên
  đường và tên quán ở Việt Nam kỹ hơn; khoá sai hoặc hết hạn thì tự quay về OpenStreetMap
  chứ không để bản đồ trắng, và dòng ghi nguồn dưới bản đồ đổi theo cái đang thật sự vẽ.
- **Đường đi thật giữa các điểm dừng** khi có `VITE_GOONG_API_KEY` — một lần gọi Goong
  Direction cho cả ngày, vẽ liền nét theo đường bộ thay cho nét đứt chim bay, và hiện số km
  đường bộ kèm thời gian đi ngay dưới tên ngày.
- **Xuất PDF** — nút trên màn chi tiết mở hộp thoại In của trình duyệt với một bản riêng:
  **cả chuyến**, mọi ngày một lượt (màn hình chỉ hiện một ngày), kèm khoản chi và số dư.
- **Ngân sách** — bảng khoản chi (thêm / sửa / xoá), ngân sách kế hoạch sửa được, thanh tiến độ,
  số dư từng người sau chia đều, và **tất toán gọn nhất** (greedy — thường n−1 giao dịch,
  không đảm bảo tối thiểu tuyệt đối), đánh dấu đã trả.
- **Thành viên & quyền** — Chủ chuyến đi / Sửa / Xem, mời qua email (thêm trạng thái
  "Chờ phản hồi"), chia sẻ liên kết + sao chép (báo lỗi thật khi trình duyệt chặn clipboard).
  Gỡ một người còn khoản chi thì SmartTrip hỏi chuyển khoản đó cho ai, thay vì tự đẩy sang
  người đầu danh sách.
- **Cẩm nang bản địa** — tab thứ tư trong chuyến đi. Chọn một nơi (gợi ý sẵn từ tên chuyến
  và danh sách ngày, hoặc gõ nơi khác) rồi soạn một lần: tiền bạc, đi lại, ăn uống, phong
  tục, an toàn, kèm 10–14 câu giao tiếp có chữ bản địa và cách đọc, và các số khẩn cấp.
  Một document cho mỗi điểm đến, cả nhóm cùng đọc, và **bản sao nằm lại trong máy** nên
  mở được cả khi mất mạng.
- **Sổ tay dịch** (nút `Dịch` trên nav) — gõ câu tiếng Việt, chọn ngôn ngữ, rồi đưa màn
  hình cho người đối diện đọc: bản dịch được in to nhất trên trang, kèm cách đọc theo âm
  tiếng Việt và **nghĩa đen dịch ngược** để bạn tự kiểm tra được câu mình sắp nói. Câu nào
  đã dịch một lần thì nằm lại trong trình duyệt — mở lại không tốn thêm lượt gọi AI, và
  vẫn tra được khi không có mạng.
- **Phụ đề tiếng Anh** bật/tắt (nút `EN` trên nav) — hỗ trợ khách quốc tế. Đây là phụ đề
  cạnh nhãn tiếng Việt, không phải dịch toàn bộ giao diện; mỗi phụ đề mang `lang="en"` nên
  trình đọc màn hình phát âm đúng tiếng Anh.
- **Tìm kiếm & lọc chuyến đi** trên màn Chuyến đi (theo từ khoá và trạng thái).
- **Toast thông báo** khi tối ưu tuyến, ghi khoản chi, sao chép liên kết, gửi lời mời.
- **Đăng nhập thật** bằng Firebase Auth (Google, Email/Password); mỗi người chỉ thấy chuyến đi
  mình là thành viên.
- **Đồng bộ realtime** qua Firestore — người khác sửa lịch trình hay thêm khoản chi thì màn hình
  của bạn tự cập nhật, không cần tải lại.
- **Trợ lý AI thật** bằng Firebase AI Logic (Gemini) với structured output, tạo được chuyến đi
  mới thẳng từ bản nháp. Form hỏi **ngày khởi hành và ngày kết thúc** rồi tự suy ra số ngày,
  **số người gõ tay**, và phong cách có ô **"Khác"** để tự viết thứ bạn quan tâm.
- **Trợ lý ngay trong chuyến đi** — tab thứ hai của mỗi chuyến, và nó là một **cuộc trò
  chuyện**: nhắn như nhắn cho một người bạn rành đường, hỏi lại được, nói tiếp được
  ("thêm một quán nữa" hiểu "nữa" là gì). Hỏi thông tin thì nó trả lời; muốn đổi lịch trình
  thì nó kèm theo một đề xuất cho **đúng một ngày**, đánh dấu **mới** vào những điểm dừng
  chưa có. Không gì được ghi vào chuyến đi cho tới khi bạn bấm áp dụng, và bấm xong vẫn ở
  lại trong cuộc trò chuyện để nói tiếp.
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

44 ca, chạy trên emulator (cần JDK 21+): ai đọc được gì, editor có tự nâng quyền hay
sửa được danh sách thành viên không, toàn bộ luồng nhận lời mời, luồng tự rời chuyến —
kể cả các trường hợp cố tình lách — và **shape của dữ liệu ghi vào**: tiêu đề quá dài,
`plan` âm, `settled` là mảng thay vì map, một ngày nhồi hàng trăm điểm dừng, số tiền là
chuỗi. Nhóm cuối này quan trọng vì rules chỉ chặn được những gì nó gọi tên: người có
quyền Sửa là bên thứ ba đối với cơ sở dữ liệu, và trước đây không gì ngăn họ ghi một
document rác vào `days`/`expenses`.

### 4. Bật Firebase AI Logic (Trợ lý AI)

**Build → AI Logic → Get started**, chọn backend **Vertex AI Gemini API** (trong tài liệu
mới của Google nó tên là *Agent Platform*). Firebase sẽ tự bật API cần thiết trên project
và ký request phía server — client không giữ khoá Gemini hay Google Cloud nào; request
được cho qua nhờ App Check cộng với người dùng đang đăng nhập.

Đây cũng là mặc định của app. Muốn đi đường **Gemini Developer API** cũ thì chọn nó ở màn
này và đặt `VITE_FIREBASE_AI_BACKEND=google` trong `.env.local` — hai bên cùng SDK, cùng
schema, cùng câu trả lời, chỉ khác API nào phải bật và có ghim vùng chạy hay không.

#### Bật App Check (bắt buộc cho AI Logic)

Firebase **từ chối phục vụ AI Logic cho project chưa enforce App Check** — lỗi trả về là
`403 ... you must enforce Firebase App Check`. Auth và Firestore vẫn chạy bình thường,
chỉ Trợ lý AI bị khoá.

Provider bắt buộc là **reCAPTCHA Enterprise**. reCAPTCHA classic (v3) đã bị Google khai
tử cho luồng này — chọn nó trong Firebase Console chỉ nhận lại
`reCAPTCHA is deprecated, please use reCAPTCHA Enterprise instead.` Enterprise **không cần
bật billing**, chạy được trên gói Spark miễn phí, và **không có secret key** — chỉ một
**site key** công khai.

1. Tạo khoá **trước** — Firebase không tạo hộ. Vào
   [Google Cloud Console → Fraud Defense](https://console.cloud.google.com/security/recaptcha),
   đúng project của bạn → **Create key**:
   - Platform: **Website**
   - Type: **Score-based** (App Check bắt buộc score-based, không phải checkbox)
   - Domains: domain deploy của bạn, ví dụ `<project>.web.app` và `<project>.firebaseapp.com`
   - **Không thêm `localhost`** — tài liệu Firebase nói rõ đừng bỏ localhost vào khoá thật.
     Local dev đi bằng debug token ở bước 4.
2. Copy **site key** → **Build → App Check → Apps** → chọn app web `SmartTrip` →
   **reCAPTCHA Enterprise** → dán vào ô *reCAPTCHA Enterprise site key* → TTL để nguyên
   1 hour → **Save**.
3. Điền vào `.env.local` — cả hai dòng, cờ Enterprise là bắt buộc:
   ```
   VITE_FIREBASE_APPCHECK_SITE_KEY=<site key>
   VITE_FIREBASE_APPCHECK_ENTERPRISE=true
   ```
4. Chạy `npm run dev`, mở Console trình duyệt: ở chế độ dev app tự bật debug token và in ra
   một chuỗi UUID. Copy nó vào **App Check → Apps → ⋮ → Manage debug tokens**, nếu không
   thì localhost sẽ bị chặn.

   Debug token **là bí mật** — đừng commit, đừng chia sẻ. Nó gắn theo từng máy và từng
   trình duyệt: đổi máy, đổi trình duyệt, hoặc xoá storage là sinh token mới và phải đăng
   ký lại.
5. **App Check → APIs** → bật **Enforce** cho *Firebase AI Logic*. Đây mới là bước mở khoá:
   chưa enforce thì project vẫn trả 403 dù App Check đã cài đúng.

Code khởi tạo App Check nằm trong [`src/backend/firebase.js`](src/backend/firebase.js), chạy
ngay sau `initializeApp` để Auth và Firestore cũng gửi kèm token — nếu sau này bạn enforce
App Check cho cả hai dịch vụ đó thì không phải sửa gì thêm. Không điền site key thì App Check
không bật, mọi thứ khác vẫn chạy như cũ.

Model mặc định là `gemini-3.5-flash`, đổi bằng `VITE_GEMINI_MODEL` trong `.env.local`.
Vertex phục vụ model **theo vùng**, nên một model có thật vẫn có thể 404 ở vùng bạn ghim;
lỗi hiện lên nói rõ cả tên model lẫn vùng đã thử. Bỏ trống `VITE_FIREBASE_AI_LOCATION` là
dùng mặc định của SDK, và đó là lựa chọn đúng nếu bạn không có ràng buộc dữ liệu ở đâu.

Trợ lý dùng **structured output**: schema JSON được gửi kèm request nên câu trả lời về
đúng khuôn, không phải bóc tách chuỗi. Mọi thứ model trả về vẫn đi qua đúng bộ lọc
`cleanStop` như dữ liệu đọc từ Firestore trước khi được đưa vào mô hình chuyến đi.

### 5. Tìm kiếm địa điểm (không bắt buộc)

Ô **Tên điểm dừng** gợi ý địa điểm thật và điền toạ độ khi bạn chọn một gợi ý. Không cấu
hình gì thì nó dùng **Nominatim** của OpenStreetMap: miễn phí, không cần tài khoản, chạy
được ngay trên một bản clone mới. Đổi lại, Nominatim yêu cầu **tối đa một request mỗi
giây** — app tự chờ 650 ms sau phím cuối và huỷ request cũ khi bạn gõ tiếp, nên đừng gỡ
phần debounce trong [`src/components/PlaceSearch.jsx`](src/components/PlaceSearch.jsx).

Muốn kết quả sát với địa chỉ và tên quán ở Việt Nam hơn thì lấy khoá ở
[account.goong.io](https://account.goong.io) rồi thêm vào `.env.local`:

```
VITE_GOONG_API_KEY=<khoá>
```

Có khoá là tự đổi provider, không phải sửa gì thêm. Khoá này đi trong URL từ trình duyệt
nên nó **công khai** — giới hạn domain cho nó trong bảng điều khiển Goong.

Dù dùng provider nào, kết quả trả về vẫn đi qua bộ đọc trong
[`src/places.js`](src/places.js) trước khi vào dữ liệu chuyến đi: thiếu toạ độ, toạ độ
ngoài quả đất, hay thiếu tên thì bị bỏ chứ không hiện thành một dòng chết.

### 6. Bản đồ và đường đi bằng Goong (không bắt buộc)

Goong cấp **hai khoá khác nhau** và chúng không thay nhau được. Điền cái nào thì được
tính năng của cái đó; không điền cái nào thì app chạy đúng như trước.

```
VITE_GOONG_API_KEY=<khoá API>          # rsapi.goong.io
VITE_GOONG_MAPTILES_KEY=<khoá Maptiles> # tiles.goong.io
VITE_GOONG_MAP_STYLE=goong_light_v2     # tuỳ chọn
```

**Khoá API** mở ba thứ trên cùng một tài khoản: tìm địa điểm (mục 5 ở trên), **đường đi
thật** giữa các điểm dừng trong ngày, và **khoảng cách đường bộ** cho nút *Tối ưu tuyến
đường*. Một ngày là **một** lần gọi `Direction` cho cả dãy điểm dừng, và một lần
`DistanceMatrix` mỗi lần bấm tối ưu — không phải mỗi cặp một request.

Gói miễn phí của Goong là **1000 request/ngày** cho tất cả dịch vụ cộng lại và **5
request/giây** trên một IP, chia chung cho cả nhóm cùng sửa một chuyến. Nên hai cơ chế
này nằm sẵn trong code:

- **Chờ 700 ms rồi mới hỏi.** Sắp xếp một ngày là một chuỗi thao tác tay, và mỗi bước ở
  giữa là một thứ tự không ai cần đường cho nó. Đo thực tế: 6 thứ tự mới liên tiếp cách
  nhau 200 ms chỉ tốn **1** request.
- **Không hỏi lại câu đã hỏi.** Kết quả được nhớ theo toạ độ, nên chuyển qua lại giữa các
  ngày không tốn gì thêm — 8 lần chuyển giữa 3 ngày tốn **3** request. Ma trận khoảng cách
  được nhớ **không phân biệt thứ tự**, nên bấm *Tối ưu tuyến đường* lần thứ hai là miễn phí.

Chỉ câu trả lời được nhớ, không nhớ lỗi: khoá bị 403 hôm nay có thể được duyệt ngày mai.

**Khoá Maptiles** đổi nền bản đồ sang Goong. Style của Goong là **vector**, nên đường này
nạp MapLibre bằng `import()` động và chỉ nạp khi có khoá: một build không có khoá không tải
một byte nào của nó. Kiểu bản đồ chọn được trong `goong_light_v2` (mặc định),
`goong_map_web`, `goong_map_dark`, `navigation_day`, `navigation_night`; gõ sai tên thì rơi
về mặc định chứ không ra bản đồ trắng.

Cả hai đường đều **hỏng êm**: khoá sai, hết hạn, hết quota hay mất mạng thì bản đồ quay về
tile OpenStreetMap, đường nối các điểm dừng quay về nét đứt chim bay, và dòng ghi nguồn
dưới bản đồ đổi theo cái đang thật sự được vẽ. Không có gì trong ứng dụng dừng lại vì
thiếu Goong.

Hai khoá này cũng đi trong URL từ trình duyệt nên đều **công khai** — giới hạn domain cho
cả hai trong bảng điều khiển Goong.

### 7. Deploy (tuỳ chọn)

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
trips/{tripId}/guide/{slug}                      // slug: "hoi-an", sinh từ tên điểm đến
  dest, lang, currency, summary, createdAt
  sections[] { title, tips[] }   phrases[] { vi, local, roman }   emergency[] { label, value }

settled { "<fromId>><toId>:<số tiền>": true }   // khoá kèm số tiền: khoản chi đổi ⇒ dấu "đã trả" hết hiệu lực

localStorage                                     // của riêng từng máy, không đồng bộ cho ai
  smarttrip-v2         chuyến đi ở chế độ thử
  smarttrip-guides-v1  bản lưu cẩm nang, để đọc được khi mất mạng
  smarttrip-phrases-v1 sổ tay các câu đã dịch
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
  organic.css          # design system "Organic" (token + component classes) + bản in
  data.js              # seed 3 chuyến + helper ngày tháng, tiền tệ, factory
  store.jsx            # AppProvider (session + state + actions)
  budget.js            # tính tiền: số dư, tất toán gọn nhất, khoá "đã trả"
  itinerary.js         # haversine, tối ưu tuyến, thứ tự theo giờ, di chuyển một dòng
  places.js            # dựng URL và đọc kết quả của dịch vụ tìm địa điểm
  maps.js              # style bản đồ Goong, polyline, ma trận đường bộ, khoá cache
  guide.js             # slug điểm đến + đoán nơi nào đáng có cẩm nang
  phrasebook.js        # khoá cache và sổ tay các câu đã dịch
  App.jsx              # nav + điều hướng màn hình
  backend/
    config.js          # đọc biến môi trường, cờ firebaseEnabled
    firebase.js        # khởi tạo app/auth/db/ai (lazy)
    auth.js            # đăng nhập/đăng ký/đăng xuất + thông báo lỗi tiếng Việt
    schema.js          # kiểm tra và vá shape mọi dữ liệu đọc từ ngoài vào
    firestore.js       # repository chạy trên Firestore
    local.js           # repository chạy trên localStorage (chế độ thử)
    places.js          # gọi mạng cho tìm địa điểm (Nominatim hoặc Goong)
    maps.js            # gọi mạng cho bản đồ nền, đường đi và ma trận khoảng cách (Goong)
    offline.js         # bản lưu của riêng máy: cẩm nang và sổ tay dịch
    ai.js              # gọi Gemini qua Firebase AI Logic — lịch trình, sửa một ngày, cẩm nang, dịch
    index.js           # chọn repository theo cấu hình
  components/          # ui.jsx (Seg, Avatar, En, icons), MapView, PlaceSearch,
                       # TripPrintSheet, ExpenseDialog, ErrorBoundary, useFieldDraft,
                       # useRoadRoute
  screens/             # Login, Trips, Trip (+ trip/ItineraryTab|AssistantTab|BudgetTab|MembersTab|GuideTab),
                       # AIDesk, Translate, Profile
tests/
  unit/*.test.mjs            # logic thuần — `npm test`, không cần emulator
  firestore-rules.test.mjs   # kiểm thử Security Rules trên emulator
.github/workflows/ci.yml     # lint + unit + build, và rules trên một job riêng có JDK 21
firestore.rules        # ai đọc được gì, ai ghi được gì
firebase.json          # rules, hosting, cổng emulator
```

**Bốn file `.js` ở đầu `src/` đều là hàm thuần, không React, không backend.** Đó là chỗ
sai lầm khó thấy nhất — một lỗi trong `budget.js` là tiền thật chia sai — nên chúng nằm
ngoài `store.jsx` (có JSX, `node --test` không import được) để test chạy được bằng Node
trần, không cần thêm thư viện nào.

`screens/` không bao giờ gọi thẳng Firestore. Nó gọi `actions` trên store, store gọi
repository, và repository có hai bản cài đặt cùng một giao diện — Firestore hoặc localStorage.
Nhờ vậy chế độ thử không phải là nhánh `if` rải khắp giao diện.

## Bước tiếp theo (theo spec)

1. ~~Firebase Auth + Firestore + Security Rules~~ — xong, xem mục **Nối Firebase**.
2. ~~Gemini cho Trợ lý AI~~ — xong, qua Firebase AI Logic.
3. ~~Tìm kiếm địa điểm~~ — xong: Nominatim mặc định, Goong khi có khoá.
4. ~~Directions API thay cho khoảng cách đường chim bay~~ — xong, qua Goong.
   `optimizeRoute` trong [`src/itinerary.js`](src/itinerary.js) vẫn nhận hàm `distance`
   làm tham số; [`src/backend/maps.js`](src/backend/maps.js) lấy sẵn cả ma trận bằng một
   lần gọi `DistanceMatrix` rồi mới gọi, vì hàm đó phải đồng bộ. Không có khoá Goong thì
   vẫn là haversine như cũ.
5. ~~Xuất PDF~~ — xong.
6. ~~Dịch cho người đi + cẩm nang bản địa~~ — xong, xem **Tính năng đã có**.
   Còn lại: i18n đầy đủ cho giao diện, app Flutter đồng bộ Firebase.

## Còn nợ

- **SmartTrip không tự gửi email mời** — nút "Gửi email báo" mở thư nháp trong ứng dụng
  mail của người mời để họ bấm gửi. Gửi tự động cần Cloud Function, tức gói Blaze.
- Người tự rời chuyến có thể mang theo dòng thành viên của người khác: Security Rules
  ghim được *bao nhiêu* dòng ra đi chứ không ghim được *dòng nào*. Không phải leo thang
  quyền, và chủ chuyến thêm lại được — chi tiết trong CLAUDE.md.
- **Nút `EN` là phụ đề, không phải i18n.** Dịch toàn bộ giao diện vẫn còn nguyên đó —
  18 nhãn có phụ đề, còn khoảng 740 chuỗi tiếng Việt nằm thẳng trong JSX. Sổ tay dịch là
  công cụ cho *người đi*, không phải bản dịch của *giao diện*; hai việc khác nhau.
- **Cẩm nang không nằm trong bản in PDF.** Nó đọc theo yêu cầu khi mở tab, còn
  `TripPrintSheet` render từ dữ liệu chuyến đi đã có trong state — muốn in kèm thì phải
  nạp trước mọi cẩm nang của chuyến, tức đảo lại chính lý do nó không gắn listener.
- **Hai chuyến cùng đi một nơi phải soạn cẩm nang hai lần.** Có chủ ý: một collection
  dùng chung mà client ghi được thì ai cũng đầu độc được bản của người khác, và rules
  không đọc nội dung để phân biệt tốt xấu. Chi tiết trong CLAUDE.md.
- **Trần quy mô đã biết:** màn Chuyến đi hiện số điểm dừng và tổng chi của *mọi* chuyến,
  và cả hai được tính từ subcollection chứ không lưu sẵn — nên `subscribeTrips` mở hai
  listener cho mỗi chuyến. Vài chục chuyến thì ổn; trên mức đó phải đếm sẵn trên document
  chuyến đi, tức là đảo lại một quy tắc kiến trúc chứ không phải chỉnh nhẹ. Ở chế độ dev
  app tự cảnh báo khi vượt ngưỡng.
- **Đường bộ chỉ có ở tab Lịch trình, không có trong bản in.** `TripPrintSheet` render
  từ state đã có; kéo đường đi vào đó nghĩa là gọi Direction cho *mọi* ngày trước khi in.
- **maplibre-gl là 1045 kB trong `dist/`** khi bật bản đồ Goong. Nó nằm chunk riêng và
  trình duyệt chỉ tải khi có khoá Maptiles, nhưng nó vẫn là file to nhất dự án — và vì
  `chunkSizeWarningLimit` chỉ có một ngưỡng chung, nâng nó lên cho maplibre cũng nới lỏng
  cảnh báo cho `firebase-firestore`. Xem chú thích trong [`vite.config.js`](vite.config.js).
- **`firebase-firestore` 567 kB vẫn nằm trong bundle kể cả ở chế độ thử**, vì
  `backend/firebase.js` import tĩnh `getFirestore`. Bỏ được nó thì phải chuyển import đó
  vào `backend/firestore.js` rồi nạp repository bằng dynamic import — xem chú thích trong
  [`vite.config.js`](vite.config.js).
