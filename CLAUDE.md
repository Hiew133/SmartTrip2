# CLAUDE.md — ghi chú làm việc cho SmartTrip

File này dành cho các phiên làm việc sau: bối cảnh, quy ước, và những chỗ đã sập
để không sập lại. README là tài liệu giới thiệu dự án; mọi thứ mang tính vận hành
và "biết trước kẻo dẫm phải" thì ghi ở đây.

---

## Lệnh hay dùng

```bash
npm run dev        # vite, cổng 5173
npm run build      # build vào dist/
npm run lint       # eslint — phải 0 lỗi trước khi commit
npm test           # logic thuần — 133 ca, vài giây, không cần gì ngoài node
npm run test:rules # kiểm thử Security Rules trên emulator — 44 ca
```

`npm test` chạy `node --test "tests/unit/*.test.mjs"`. **Đường dẫn phải là glob trong dấu
nháy**, không phải tên thư mục: từ Node 22 `node --test tests/unit` coi đó là một *file*
và báo `Cannot find module`. Glob cũng là cách giữ `firestore-rules.test.mjs` ở ngoài —
ca đó cần emulator, còn `npm test` phải chạy được ở bất cứ đâu.

`firebase emulators` đòi **JDK 21+**. Máy này **đã có** ở
`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`, nhưng `java` trên PATH là
JDK 17, nên phải trỏ `JAVA_HOME` khi chạy test:

```bash
JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot" npm run test:rules
```

Máy khác chưa có thì `winget install EclipseAdoptium.Temurin.21.JDK`.

**`node_modules` phải cài đủ.** Bản cài dở (thiếu `firebase`, `eslint`) làm `npm run dev`
nổ hàng loạt `Failed to resolve import "firebase/..."` — trông như lỗi code nhưng chỉ là
thiếu gói. Chạy `npm install` là xong.

---

## Kiến trúc: một quy tắc quan trọng nhất

**`src/screens/` không bao giờ gọi thẳng Firestore.**

```
screens/  →  store.jsx (actions)  →  backend/index.js (repo)  →  firestore.js
                                                              └→  local.js
```

`backend/index.js` chọn bản cài đặt theo `firebaseEnabled`. Hai bản có **cùng một
giao diện repository**, nên chế độ thử không phải là nhánh `if` rải khắp giao diện.
Thêm thao tác dữ liệu mới thì phải cài ở **cả hai** file, rồi mới thêm action trong
store, rồi mới gọi từ màn hình.

### Logic thuần nằm ngoài React, có chủ ý

`budget.js`, `itinerary.js`, `places.js`, `maps.js`, `photos.js`, `guide.js`, `phrasebook.js` ở đầu `src/` không import React và không import
backend. Lý do rất cụ thể: `store.jsx` có JSX nên `node --test` không nạp được, và
`backend/config.js` đọc `import.meta.env` nên bất cứ thứ gì chạm vào nó cũng ngoài tầm
với của Node trần. Muốn test một hàm mà không kéo theo cả một test runner cho trình duyệt
thì hàm đó phải nằm ở đây.

Đó cũng là lý do tìm kiếm địa điểm bị tách đôi: `src/places.js` dựng URL và đọc JSON
(test được), `src/backend/places.js` gọi `fetch` và chọn provider (không test được).
Thêm provider mới thì viết parser ở file đầu, kèm ca test bằng JSON mẫu.

`src/maps.js` / `src/backend/maps.js` tách theo đúng cùng một đường, và vì cùng một lý do.

`optimizeRoute(items, distance)` nhận hàm khoảng cách làm tham số — mặc định là haversine.
Chỗ nối đó **đã dùng**: `roadDistance()` trong `backend/maps.js` lấy cả ma trận bằng một
lần gọi `DistanceMatrix` rồi mới dựng hàm đồng bộ. Hàm truyền vào **phải đồng bộ**, nên
mọi thứ cần mạng đều phải lấy xong trước khi gọi.

### Bản in là một component riêng, không phải CSS phủ lên màn hình

`TripPrintSheet` render **cả chuyến** — mọi ngày một lượt. Màn hình chỉ bao giờ render
đúng một ngày, nên nếu chỉ viết `@media print` đè lên giao diện thì bản PDF sẽ chỉ có một
ngày mà trông vẫn như hoàn chỉnh. Nó nằm **ngoài `<main>`** trong `App.jsx` vì lúc in
`#main` bị ẩn đi.

### `order` của ngày là chỉ số, không phải dấu thời gian

Từng có hai thang đo trong cùng một collection: `createTrip` ghi chỉ số mảng, `addDay` ghi
`Date.now()`. Sắp xếp vẫn đúng chỉ vì ngày luôn được thêm vào cuối. Giờ `order` luôn là vị
trí trong chuyến; `reorderDays` đánh số lại toàn bộ, và **xoá một ngày cũng đánh số lại**
— nếu không, `addDay` lấy `days.length` sẽ đụng số với một ngày đang tồn tại.

### Vì sao stops nằm trong document ngày

`trips/{id}/days/{dayId}` giữ luôn mảng `items`, không tách subcollection. Mọi thao
tác sửa điểm dừng (kéo-thả, tối ưu tuyến) đều ghi lại cả ngày — tách ra sẽ biến một
lần ghi thành N. Ngược lại `expenses` có document riêng vì đó mới là chỗ nhiều người
cùng thêm một lúc.

### `memberIds` và `roles` là bản sao, phải luôn dựng lại cùng `members`

Hai trường đó tồn tại chỉ để Security Rules trả lời được "uid này đọc/ghi được không"
mà không phải đọc thêm document. Hàm `derive()` trong `firestore.js` dựng chúng; mọi
đường ghi `members` đều phải đi qua đó. Rules cấm người quyền Sửa động vào chính hai
trường này, nếu không họ tự nâng mình lên owner được.

**`accessUnchanged()` phải khoá cả `members` và `pendingEmails`, không chỉ hai mirror.**
Đây từng là lỗ thật, đã dựng lại trên emulator: hai trường đó không rule nào *đọc* tới
nên trông như dữ liệu thường, và người quyền Sửa ghi được. Hậu quả:

- `members: []` → client bỏ chuyến đi không có thành viên (`cleanTrip` trả null), nên
  chuyến **biến mất khỏi màn hình của tất cả mọi người kể cả chủ**, còn document vẫn
  nằm nguyên trong Firestore, không ai lấy lại được từ trong app.
- Sửa được tên/email trên ghế của chủ chuyến.
- Thêm email lạ vào `pendingEmails` → người lạ đó **đọc được cả chuyến đi**, vì
  `isInvited()` mở quyền đọc theo đúng mảng này.

Quy tắc rút ra: trường nào `derive()` sinh ra hoặc sinh từ nó thì đều là trường quyết
định quyền, dù rule có đọc tới hay không.

---

## Quy ước

- **Dữ liệu từ ngoài luôn không đáng tin.** localStorage, document Firestore, và cả
  JSON mô hình AI trả về — tất cả đi qua `backend/schema.js` trước khi vào state.
  Chuyến đi không vá được thì bỏ, không để nó làm sập app.
- **Mọi thực thể có `id` ổn định.** Khoản chi trỏ người ứng bằng `payerId`, không bao
  giờ bằng chỉ số mảng.
- **Số hiển thị thì tính, không lưu.** Số điểm dừng, tổng chi, trạng thái chuyến,
  "khởi hành sau N ngày" — đều derive. Đừng thêm trường đếm sẵn vào Firestore.
- **Ô nhập chữ dùng `useFieldDraft`.** Bind thẳng vào dữ liệu chuyến đi là mỗi phím gõ
  thành một lần ghi database.
- **Khoá `settled` kèm số tiền** (`settleKey`). Đổi khoản chi ⇒ giao dịch cũ không còn,
  dấu "đã trả" tự hết hiệu lực. Đây là bản sửa cho một lỗi thật, đừng rút gọn lại.
- **Tiền luôn hiển thị qua `fmt()`**, và khoảng trắng trước `₫` trong đó là
  **non-breaking**. Khoảng trắng thường thì trình duyệt được phép xuống dòng ngay chỗ
  đó, và trong ô hẹp nó làm đúng thế: số một dòng, mỗi chữ `₫` một dòng. Có ca test ghim
  mã ký tự 160, đừng "dọn" nó thành dấu cách thường.

---

## Firebase

Project: **`nihon-speaking-29442-5f1db`** (`.firebaserc` đã trỏ sẵn).
Web app: `SmartTrip`, app ID `1:504236832610:web:cc79a407dac3a70261de3b`.

Config nằm ở `.env.local` — **không có trong git**. Lấy lại bằng:

```bash
npx firebase apps:sdkconfig WEB 1:504236832610:web:cc79a407dac3a70261de3b
```

### Trạng thái từng phần

| Phần | Trạng thái |
|---|---|
| Auth (Google + Email/Password) | ✅ chạy thật, đã đăng nhập được |
| Firestore đọc/ghi | ✅ chạy thật, chuyến đi đọc từ cloud |
| Security Rules | ✅ đã deploy, đã xác nhận chặn truy cập vô danh (403) |
| Firebase AI Logic (Gemini) | ✅ chạy thật — sinh lịch trình có toạ độ, tạo được chuyến đi |
| Backend cho Gemini | Vertex AI mặc định — đã xác nhận dựng đúng `AgentPlatformBackend` / `AGENT_PLATFORM` / vùng `global` trên project thật; **lượt gọi model chưa thử** (xem dưới) |
| App Check (reCAPTCHA Enterprise) | ✅ đã enforce, debug token localhost đã đăng ký |
| Test Security Rules | ✅ 44/44 pass trên emulator (quyền + shape dữ liệu ghi vào) |
| Test logic thuần | ✅ 133/133 pass, `npm test`, không cần emulator |
| CI | ✅ `.github/workflows/ci.yml` — lint + unit + build, rules ở job riêng có JDK 21 |
| Tìm kiếm địa điểm | ✅ Nominatim mặc định (không cần khoá), Goong khi có `VITE_GOONG_API_KEY` |
| Bản đồ nền Goong | ✅ vector tile qua MapLibre khi có `VITE_GOONG_MAPTILES_KEY`, tự rơi về OSM |
| Đường đi & khoảng cách đường bộ | ✅ Goong Direction + DistanceMatrix khi có `VITE_GOONG_API_KEY` |
| Xuất PDF | ✅ qua hộp thoại In của trình duyệt, bản in riêng gồm cả chuyến |
| Nhận lời mời | ✅ tự nhận ghế khi đăng nhập (cần email đã xác minh) |
| Gỡ / rời thành viên | ✅ chủ gỡ được người khác và huỷ được lời mời; người khác tự rời được |
| Xoá chuyến đi | ✅ chủ xoá được, xoá luôn `days`, `expenses` và `guide` |
| Liên kết chia sẻ `/t/{id}` | ✅ mở đúng chuyến, giữ được qua bước đăng nhập |
| Cẩm nang bản địa | ✅ một mục trong chuyến đi, một document mỗi điểm đến, có bản lưu ngoại tuyến |
| Trợ lý trong chuyến đi | ✅ panel trò chuyện dán trên bản đồ — hỏi được, đề xuất một ngày, xem trước rồi mới ghi |
| Sổ tay dịch | ✅ Việt·Anh·Nhật hai chiều, có micro và loa (Web Speech API), cache trong máy |
| Ảnh bìa địa điểm | ✅ Wikipedia geosearch theo toạ độ, không cần khoá, cache trong máy |

> **`.env.local` không có trong git.** Máy nào chưa có thì app chạy **chế độ thử**:
> dữ liệu trong localStorage, Trợ lý AI trả bản nháp mẫu. Đó là hành vi đúng, không
> phải hỏng — nhưng đừng kết luận gì về Firestore/Rules khi đang ở chế độ đó.

Đã chạy thật trên project, không phải chỉ build: đăng nhập, đọc chuyến đi, `setDoc`,
batch ghi ngày, `updateDoc` khoản chi, `runTransaction` mời thành viên, và Gemini sinh
lịch trình có toạ độ rồi tạo chuyến mới từ bản nháp.

---

## App Check — đã xong

Firebase từ chối phục vụ AI Logic cho project chưa enforce App Check
(`403 ... you must enforce Firebase App Check`). Đã cấu hình xong; phần dưới giữ lại
để dựng lại từ đầu hoặc làm trên máy khác.

**Debug token gắn theo từng máy/trình duyệt.** Máy khác, trình duyệt khác, hoặc xoá
storage là sinh token mới và phải đăng ký lại — nếu không thì local dev không lấy được
App Check token. Dấu hiệu: console báo
`Error while retrieving App Check token ... 403` mỗi lần tải trang.

### Provider: reCAPTCHA Enterprise (bắt buộc)

Google đã **khai tử reCAPTCHA classic** — chọn nó trong Console sẽ báo
`reCAPTCHA is deprecated, please use reCAPTCHA Enterprise instead.`
Nên chỉ còn một đường: **reCAPTCHA Enterprise**.

Enterprise **không cần bật billing** — chạy được trên gói Spark miễn phí (chỉ giới hạn
4 mức điểm thay vì 11, không ảnh hưởng gì tới App Check).

Firebase Console hỏi **site key** (khoá công khai), không phải secret — Enterprise không
có secret key riêng cho luồng này. Code dùng `ReCaptchaEnterpriseProvider`, đã bật bằng
`VITE_FIREBASE_APPCHECK_ENTERPRISE=true`.

### Các bước

1. **Google Cloud Console → Fraud Defense** ([console.cloud.google.com/security/recaptcha](https://console.cloud.google.com/security/recaptcha)),
   đúng project `nihon-speaking-29442-5f1db` → **Create key**:
   - Platform: **Website**
   - Type: **Score-based** (App Check bắt buộc score-based, không phải checkbox)
   - Domains: `nihon-speaking-29442-5f1db.web.app` và
     `nihon-speaking-29442-5f1db.firebaseapp.com`
   - **Không thêm `localhost`** — tài liệu Firebase nói rõ đừng bỏ localhost vào khoá
     thật. Local dev đi bằng debug token ở bước 4.
2. Copy **site key** → Firebase Console → **App Check → Apps → SmartTrip →
   reCAPTCHA Enterprise** → dán vào ô *reCAPTCHA Enterprise site key* → TTL để nguyên
   1 hour → **Save**.
3. `.env.local`:
   ```
   VITE_FIREBASE_APPCHECK_SITE_KEY=<site key>
   VITE_FIREBASE_APPCHECK_ENTERPRISE=true
   ```
4. `npm run dev` → mở Console trình duyệt, app tự in **debug token** (UUID) → copy vào
   **App Check → Apps → ⋮ → Manage debug tokens**. Đây là cách localhost qua được mà
   không phải nhét localhost vào khoá thật.

   Debug token **là bí mật** — đừng commit, đừng chia sẻ. Xoá nó khi không cần nữa.
   Token đổi khi xoá storage trình duyệt hoặc dùng máy khác, lúc đó phải đăng ký lại.

   `firebase appcheck:debugtokens:create` mà SDK gợi ý **chưa có** trong firebase-tools
   15.22.1 — phải làm bằng Console.
5. **App Check → APIs** → **Enforce** cho *Firebase AI Logic*. Đây mới là bước mở khoá:
   chừng nào chưa enforce thì project vẫn ở trạng thái "AI Logic deactivated" và trả 403,
   dù App Check đã cài đúng.

### App Check không làm hỏng Auth/Firestore

Đã kiểm tra: khi App Check đã khởi tạo nhưng token lấy về 403 (chưa đăng ký debug token),
Auth và Firestore **vẫn chạy bình thường** — chỉ có một dòng warning
`@firebase/auth: Error while retrieving App Check token`. Lý do: App Check chưa được
enforce cho hai dịch vụ đó. Nếu sau này bạn enforce cho cả Firestore thì debug token
bắt buộc phải đăng ký, không thì local dev mất quyền đọc/ghi.

> **Site key công khai.** Nó nằm sẵn trong mọi trang dùng reCAPTCHA nên vào `.env.local`
> là bình thường. App Check không bảo vệ bằng cách giấu khoá này, mà bằng việc reCAPTCHA
> chỉ cấp token cho request đến từ đúng domain đã đăng ký.

---

## Đang vướng

### Rời chuyến: rules ghim được số dòng, không ghim được dòng nào

`leavesOwnSeat()` cho người không phải chủ tự bỏ ghế của mình. Nó bắt buộc bỏ đúng uid
và role của người gọi, bớt đúng **một** dòng `members`, và không thêm sửa gì. Nhưng
rules **không duyệt được mảng** để đối chiếu một dòng với `request.auth.uid`, nên nó
không kiểm được dòng bị bỏ có phải của người gọi hay không — người rời đi có thể mang
theo dòng của người khác.

Không phải leo thang quyền: nạn nhân vẫn còn uid trong `memberIds` và `roles` nên quyền
ở tầng rules còn nguyên, chỉ là biến mất khỏi danh sách thành viên trên giao diện, và
chủ chuyến thêm lại được. Bịt hẳn thì phải đưa danh tính ghế lên **khoá document**
(`members/{uid}`) thay vì nằm trong một mảng — đổi cả mô hình dữ liệu.

### Khác

- Kéo-thả vẫn dùng HTML5 drag & drop nên vẫn chỉ chạy bằng chuột. **Nút ↑ ↓ cạnh mỗi
  điểm dừng là đường đi cho cảm ứng và bàn phím** — cùng một hàm `moveItem`, nên ba lối
  vào không thể bất đồng ý về "chuyển xuống" nghĩa là gì. Đừng gỡ nút đi mà chỉ sửa DnD.
- Trong Browser pane lúc kiểm thử, `net::ERR_CONNECTION_REFUSED` là do môi trường chặn
  host ngoài (ảnh picsum, tile OpenStreetMap, Google Fonts) — không phải lỗi app.
- `npm run lint` còn **5** cảnh báo có sẵn từ trước — `react-hooks/set-state-in-effect`
  (animation vào màn, toast, count-up) để mức `warn` có chủ ý, cộng hai directive
  `eslint-disable` thừa trong `firestore.js`. Không phải bỏ sót. **0 lỗi.**

  Dấu cách trước `₫` trong `fmt()` giờ viết là `\u00A0` chứ không gõ thẳng: ký tự y hệt,
  nhưng ký tự sống làm `no-irregular-whitespace` báo **error** và cổng lint đỏ. Ca test
  ghim mã 160 là thứ giữ cho escape đó không bị "dọn" thành dấu cách thường.
- `npm run build` **sạch**. `chunkSizeWarningLimit` nay là **1100** kèm lý do trong
  `vite.config.js`: chunk to nhất giờ là `maplibre-gl` 1045 kB (bản đồ nền Goong), sau đó
  là `firebase-firestore` 568 kB. Cả hai là vendor, nằm chunk riêng, chỉ đổi khi đổi SDK.
  Ngưỡng vẫn đặt sát ngay trên con số thật để cái gì phình ra thì cảnh báo lại kêu —
  nhưng vì chỉ có **một** ngưỡng chung, nâng nó cho maplibre cũng nới lỏng cảnh báo cho
  firestore. 568 là con số để đối chiếu nếu chunk đó có ngày trông đáng ngờ.

  `maplibre-gl` chỉ được `import()` khi có khoá Maptiles, nên build không khoá **không
  bao giờ tải** file đó — nó nằm trong `dist/` mà không ai xin.

  Muốn bỏ hẳn 567 kB đó ở chế độ thử thì **lazy repository thôi là chưa đủ** —
  `backend/firebase.js` import tĩnh `getFirestore` để `db()` giữ được tính đồng bộ cho
  mọi call site trong `backend/firestore.js`. Phải chuyển import đó vào chính
  `backend/firestore.js` rồi mới `import()` động repository được. Chưa làm vì đường
  Firebase thật không kiểm chứng được từ đây, mà đó đúng là chỗ hay khác đường mock.

- Leaflet nạp bằng `lazy()` trong `ItineraryTab`, fallback là đúng cái hộp cùng chiều cao
  nên không giật layout. Người dùng vào màn danh sách trước, nên 150 kB đó không nằm trên
  đường tải đầu nữa.

---

## Nhận lời mời — cách nó chạy

Không dùng Cloud Function (Functions đòi Blaze). Thay vào đó trip có thêm bản sao thứ ba
`pendingEmails: [email]`, và người được mời **tự xếp ghế cho mình**:

1. Chủ chuyến mời → `members` thêm một người `pending: true, uid: null`, và
   `derive()` đưa email họ vào `pendingEmails`.
2. Người đó đăng nhập → `claimInvites()` truy vấn
   `where('pendingEmails','array-contains', email)`, rồi transaction điền `uid` vào ghế
   của chính mình.
3. Rules cho phép đúng một thao tác đó và không gì khác — `claimsOwnSeat()` bắt buộc
   `memberIds` chỉ thêm đúng uid người gọi, `pendingEmails` chỉ bớt đúng email người gọi,
   `roles` chỉ đổi đúng khoá của họ và không được là `owner`, và mọi trường khác của
   chuyến đi giữ nguyên.

Ba chi tiết đi kèm:

- **Gửi email báo** trong tab Thành viên mở một thư nháp `mailto:` trong ứng dụng mail
  của người mời, điền sẵn tiêu đề, liên kết chuyến đi và hướng dẫn. SmartTrip không tự
  gửi mail — làm vậy cần Cloud Function, mà Functions đòi gói Blaze. Cách này cho kết
  quả tương đương, không phải deploy gì, và người mời thấy rõ mình gửi cái gì.
- **`repairMirrors()`** chạy một lần sau đăng nhập, vá những chuyến đi ghi trước khi có
  `pendingEmails` — không có nó thì lời mời cũ vĩnh viễn không ai nhận được. Chỉ ghi khi
  bản sao thật sự lệch, và chỉ trên chuyến mình làm chủ.
- **`refreshUser()`** cho nút "Tôi đã xác minh xong". `emailVerified` nằm trong phiên
  đăng nhập, nên bấm link trong hộp thư không làm tab này biết gì cho tới khi
  `user.reload()`. Xác minh xong thì nó nhận luôn lời mời đang chờ.

**Bắt buộc email đã xác minh.** Nếu không thì ai cũng đăng ký bằng email người khác rồi
đi thẳng vào chuyến của họ. Đăng nhập Google là xác minh sẵn; đăng ký bằng mật khẩu thì
`signUpWithEmail` gửi link xác minh, và `claimInvites` **bỏ qua luôn truy vấn** khi
`emailVerified` false — nếu không nó sẽ ném permission-denied mỗi lần đăng nhập. Màn
Chuyến đi hiện một dòng nhắc, nhưng **các nút thao tác nằm ở trang cá nhân**, chỉ một
bản duy nhất.

---

## Trang cá nhân, và xác minh email ở chế độ thử

`screens/Profile.jsx`, vào bằng cách bấm tên trên thanh trên cùng (chấm cam cạnh tên
nghĩa là email chưa xác minh). Nó giữ toàn bộ luồng xác minh: gửi lại link, "Tôi đã xác
minh xong" (`refreshUser` → `claimInvites`), và cho biết tài khoản đăng nhập bằng gì —
`shape()` nay mang thêm `provider` lấy từ `providerData`.

**Chế độ thử mô phỏng trạng thái xác minh, không hard-code `true` nữa.** Trước đây
`demoSignIn` luôn đặt `emailVerified: true`, nên trang này không có gì để hiện đúng
trong chế độ mà một bản clone mới chạy vào. Giờ:

| Đường vào | `emailVerified` |
|---|---|
| Tiếp tục với Google | `true` — tài khoản Google về là đã xác minh, giống thật |
| Đăng ký email + mật khẩu | `false` |
| Đăng nhập lại cùng địa chỉ đó | giữ nguyên cái đã xác nhận |

Không có hộp thư nào để gửi tới, nên `verifyDemoEmail()` thay cho việc bấm link. Nó
**ném lỗi khi `firebaseEnabled`** — đừng gỡ cái chặn đó, nếu không sẽ tồn tại một đường
tự đánh dấu đã xác minh ở môi trường thật.

---

## Liên kết chia sẻ `/t/{tripId}`

App **không có router** — nó là một chồng màn hình điều khiển bằng state. `store.jsx`
đọc `location.pathname` đúng một lần lúc khởi động (`readSharedTripId`) và giữ lại
thành `pendingTripId`, vì lúc đó chưa có danh sách chuyến đi và có khi còn chưa đăng
nhập. Link được xử lý **trong callback của `subscribeTrips`**, không phải trong một
effect riêng: đó đã là chỗ dữ liệu từ ngoài đổ về, nên không đẻ thêm cảnh báo
`set-state-in-effect`.

Hai chi tiết:

- **Chỉ kết luận khi `fromCache` là false.** Snapshot từ cache chưa đủ để nói chuyến đi
  ngoài tầm với — có thể nó chỉ chưa được tải về.
- **`history.replaceState` về `/` sau khi dùng xong**, để tải lại trang không đuổi theo
  link một lần nữa.

Không xem được thì hiện toast nhắc nhờ chủ chuyến mời — với một link chuyển tay cho
người chưa được mời thì đó là chuyện bình thường, không phải lỗi.

Hosting đã rewrite mọi path về `index.html` (`firebase.json`), nên vào thẳng link là một
lần khởi động bình thường với pathname khác.

## Cẩm nang bản địa và sổ tay dịch

Hai tính năng, một hạ tầng. Cả hai đều là: hỏi Gemini → làm sạch bằng `schema.js` →
lưu lại để không hỏi lại. Chỗ khác nhau duy nhất là **lưu ở đâu**, và đó là một
quyết định có lý do.

### Cẩm nang nằm trong chuyến đi, không nằm ở collection dùng chung

`trips/{tripId}/guide/{slug}` — một document mỗi điểm đến, `slug` sinh bởi `slugFor()`
trong `src/guide.js` (bỏ dấu, ASCII, chữ thường). "Hội An" và "Hoi An" cố tình ra cùng
một slug: người gõ không dấu vẫn đang nói về nơi đó, và hai cẩm nang cho một phố cổ là
lỗi chứ không phải tính năng.

Đã cân nhắc một collection `guides/{thành-phố}` dùng chung cho mọi chuyến đi rồi bỏ:
client ghi vào đó nghĩa là **bất kỳ ai cũng đầu độc được cache của người khác**, mà rules
không đọc được nội dung để phân biệt tốt xấu. Hai chuyến cùng đi Hội An phải soạn hai lần
là cái giá rẻ hơn nhiều.

### Cẩm nang đọc theo yêu cầu, không gắn listener

`subscribeTrips` đã mở **hai** listener cho mỗi chuyến và có sẵn cảnh báo khi vượt ngưỡng.
Thêm cái thứ ba cho nội dung chỉ một tab nhìn tới sẽ hạ trần quy mô đó xuống một phần ba
mà chẳng đổi lại được gì — cẩm nang không tự đổi trong lúc đang đọc. Nên nó đi bằng
`getDoc` khi mở tab, và **không nằm trong `state.trips`**: `GuideTab` giữ nó.

Trong `GuideTab`, "đang tải" **suy ra từ việc slug lệch nhau** (`loaded.slug !== slug`)
chứ không phải một cờ riêng. Hai lý do: cờ thứ hai thì có ngày nó bất đồng với dữ liệu,
và cách này khiến câu trả lời cho một điểm đến người dùng đã bỏ qua không bao giờ hiện
dưới tên điểm đến mới.

### `backend/offline.js` — bản lưu của riêng máy này

Giống `backend/places.js`, nó **không phải repository và không có bản demo song sinh**:
nó không giữ gì thuộc về chuyến đi và không ai khác đọc được. Nó tồn tại vì cả hai tính
năng đều được dùng đúng lúc mạng tệ nhất — đứng giữa chợ nước ngoài, tắt roaming, cần
biết cái biển kia viết gì.

- Mọi cẩm nang **đọc được đều ghi kèm vào máy**, và `loadGuide` **rơi về bản đó khi
  round-trip lỗi**. Firestore không bật offline persistence, nên nếu không có bước này
  thì cẩm nang chỉ mở được khi có mạng.
- Sổ tay dịch **chỉ sống ở đây** — nó là tiện ích cá nhân, không phải nội dung chuyến đi,
  nên không cần Firestore, không cần rules, và chạy y hệt nhau ở hai chế độ.
- Đọc ra vẫn đi qua `cleanGuide` / `cleanTranslation`. Giá trị trong localStorage
  không đáng tin hơn một document Firestore: bản build này không chắc đã ghi nó.

### Khoá cache của bản dịch là cả tính năng

`phraseKey(source, target)` trong `src/phrasebook.js`: bỏ khoảng trắng thừa, không phân
biệt hoa thường, **nhưng phân biệt ngôn ngữ đích**. Lỏng quá thì hai câu khác nhau dùng
chung một câu trả lời; chặt quá thì cùng một câu tốn một lượt gọi model mỗi lần hỏi. Cả
hai đều hỏng im lặng, nên cả hai đều có ca test.

### Rules: `guide` là con thứ ba, và nó phải chết trước cha

`guideWellFormed()` chặn kiểu và **số dòng** (20 mục, 60 câu, 20 đầu mối khẩn cấp).
Rules không duyệt được mảng nên **độ dài từng dòng là việc của `schema.js`** — nếu thiếu
phần cắt trong đó thì một document đúng chuẩn với rules vẫn có thể mang cả megabyte chữ
vào trình duyệt của mọi thành viên.

`deleteTrip` giờ lấy cả `guide` vào danh sách con phải xoá trước. Đây đúng là cái bẫy đã
ghi ở mục "Những chỗ đã sập": rule của con `get()` lên trip cha để tra quyền, cha mất
trước là con thành mồ côi vĩnh viễn.

### `askModel()` gom một chỗ

Ba tính năng cùng gọi Gemini và cùng hỏng theo đúng hai kiểu (chưa enforce App Check,
chưa bật AI Logic), nên phần nạp SDK, dựng model, dịch lỗi sang tiếng Việt nằm trong một
hàm. Mỗi bên gọi mang schema, prompt và `temperature` của mình — cẩm nang 0.6, bản dịch
0.3, lịch trình vẫn 0.9. Vẫn nguyên luật cũ: **mọi object lồng trong schema phải viết
`Schema.object({ properties: { … } })`**.

## Goong: bản đồ nền, đường đi, và khoảng cách đường bộ

Ba tính năng, hai khoá, và một quy tắc chung: **không cái nào được là điều kiện để app
chạy**. Không khoá, khoá sai, hết quota, mất mạng — tất cả đều rơi về đúng hành vi cũ
(tile OpenStreetMap, đường nét đứt chim bay) chứ không phải màn hình trắng hay exception.
Vì thế `backend/maps.js` **trả `null` chứ không ném** cho mọi lỗi nó biết trước; chỉ
`AbortError` được ném tiếp, vì đó là người dùng gõ tiếp chứ không phải hỏng.

### Hai khoá, không thay nhau được

Goong cấp `VITE_GOONG_API_KEY` cho `rsapi.goong.io` (geocode, Direction, DistanceMatrix)
và `VITE_GOONG_MAPTILES_KEY` cho `tiles.goong.io` (bản đồ nền). Khoá này không mở được
dịch vụ kia. Đọc thành **hai** setting là có chủ ý — nửa nào cấu hình được thì chạy nửa đó.

Cả gateway của Goong **kiểm khoá trước khi định tuyến**, nên `403 API_KEY_INVALID` trả về
giống hệt nhau cho endpoint có thật và endpoint bịa. Đừng dùng mã lỗi để đoán xem một
endpoint có tồn tại hay không — đã thử, nó nói dối.

### Giả định chưa kiểm chứng được: `origins` nhiều giá trị

Ví dụ chính thức của `DistanceMatrix` chỉ có **một** `origins` và nhiều `destinations`.
Việc nối `origins` bằng `|` để xin cả ma trận N×N là **suy ra**, chưa xác nhận trên khoá
thật — tài khoản Goong lúc viết code vẫn đang chờ duyệt thủ công.

Nếu họ không phục vụ kiểu đó thì `parseDistanceMatrix` thấy sai kích thước và trả null,
tức là *Tối ưu tuyến đường* âm thầm quay về đường chim bay — hỏng mà nhìn không ra. Vì thế
có `unusable()`: một câu trả lời **200 nhưng sai shape** in cảnh báo kèm nguyên văn JSON,
thay vì lặng lẽ đi tiếp. Người đầu tiên cắm khoá thật vào nên mở Console xem dòng đó có
hiện không.

### Bản đồ nền của Goong là **vector**, Leaflet không đọc được

Style của Goong là `https://tiles.goong.io/assets/<tên>.json` cho MapLibre/Mapbox GL —
**không có raster tile**, nên `L.tileLayer` không dùng được. Đường đi là
`@maplibre/maplibre-gl-leaflet`: MapLibre vẽ nền trong một pane của Leaflet, còn toàn bộ
ghim, popup và `fitBounds` vẫn là Leaflet như cũ. Đó là lý do chọn nó thay vì goong-js —
đổi sang goong-js là viết lại cả `MapView`.

Ba chi tiết bắt buộc:

- **`maplibre-gl` phải nằm trong `optimizeDeps.include`** của `vite.config.js`, y hệt
  `firebase/ai` và vì đúng cái bẫy đó: nó chỉ được `import()` động nên Vite không thấy
  lúc quét, phát hiện muộn, tái tối ưu, đổi `browserHash`, và request đang bay thành 404.
- **Dùng export có tên của plugin, đừng dùng `L.maplibreGL`.** Plugin chỉ gắn mình vào `L`
  khi `Object.isExtensible(L)`, mà qua bundler thường là không.
- **Chỉ rơi về OSM khi lỗi đến *trước* sự kiện `load`.** MapLibre bắn `error` cho cả một
  tile lẻ hết giờ; gỡ cả nền vì một cái như thế còn tệ hơn chính cái trục trặc đó. Lỗi
  trước `load` mới là "khoá sai / style không có".

Đã dựng lại đúng cảnh khoá sai trong trình duyệt: style trả 403 → rơi về OSM → 12 tile OSM
vẽ ra, đường nét đứt quay lại, không có lỗi nào lọt lên giao diện.

### Dòng ghi nguồn phải theo cái đang vẽ, không theo cái đã cấu hình

`MapView` gọi ngược `onBasemap('goong' | 'osm')` khi biết chắc, và `ItineraryTab` để
figcaption chạy theo. Bản đầu tiên lấy thẳng từ config, và sau một lần rơi về OSM nó ghi
"Bản đồ © Goong Maps" bên dưới một bản đồ OpenStreetMap — ghi sai nguồn là chuyện giấy
phép, không chỉ là chữ nghĩa.

### Quota là ràng buộc thiết kế, không phải chuyện vận hành

Gói miễn phí của Goong: **1000 request/ngày cho tất cả dịch vụ cộng lại**, **5
request/giây trên một IP**, và **$100 credit dùng một lần** (không phải hàng tháng). Cả
nhóm cùng sửa một chuyến thì tiêu chung cái quota đó. Ba cơ chế dưới đây tồn tại vì con
số 1000, đừng gỡ cái nào mà không thay bằng thứ khác.

**Một ngày là một request, không phải một cặp một request.** `Direction` nhận `origin` là
điểm đầu và `destination` là **cả phần còn lại nối bằng `;`**, trả `legs` theo đúng thứ tự
đó cộng một `overview_polyline`. `DistanceMatrix` nhận `origins`/`destinations` nối bằng
`|`. Vì vậy vẽ đường cả ngày tốn một lần gọi, và mỗi lần bấm *Tối ưu tuyến đường* tốn thêm
một lần. `MAX_ROUTE_POINTS` chặn ở 12.

**Khoá request là toạ độ, không phải `day.items`.** `routeKey()` / `matrixKey()` trong
`src/maps.js` là thứ quyết định "cùng một câu hỏi" nghĩa là gì, nên chúng là hàm thuần có
ca test riêng. Ngày bị ghi lại mỗi lần gõ một chữ trong ghi chú hay sửa một con số dự chi,
mà không cái nào làm đường đi đổi.

Hai khoá đó **cố tình khác nhau**: `routeKey` **có** phân biệt thứ tự vì đường vẽ đi theo
danh sách; `matrixKey` **không**, vì ma trận chứa mọi cặp bất kể thứ tự. Nhờ vậy bấm *Tối
ưu tuyến đường* lần thứ hai — ngay sau khi chính nó vừa xáo lại ngày — không tốn request
nào. Thứ được cache là **hàm tra cứu đã dựng xong**, và nó khớp điểm dừng với dòng ma trận
theo toạ độ chứ không theo chỉ số, nên vẫn đúng sau khi thứ tự đã đổi.

**Debounce 700 ms trước khi hỏi** (`ROUTE_DEBOUNCE_MS`). Sắp xếp một ngày là một chuỗi
thao tác tay, mỗi bước là một thứ tự không ai cần đường cho nó. Cùng lý do với
`PLACE_DEBOUNCE_MS`, và với trần 5 request/giây thì nó còn là chống vượt tốc độ chứ không
chỉ tiết kiệm.

**Chỉ cache câu trả lời, không cache thất bại.** 403 hôm nay là cái khoá được duyệt ngày
mai; nhớ nó lại thì phải tải lại trang mới thoát ra được.

Đã đo trong trình duyệt bằng cách vá `window.fetch` trả về câu trả lời Goong giả:
8 lần chuyển qua lại giữa 3 ngày → **3** request; 6 thứ tự mới liên tiếp cách nhau 200 ms →
**1** request; bấm tối ưu hai lần → **1** request `DistanceMatrix`. Trước khi có hai cơ chế
này thì lần lượt là 9, 6 và 2.

### Tổng cộng dồn không đủ thì không hiện, chứ không hiện một nửa

`parseDirection` trả `km`/`minutes` là `null` trừ khi **mọi** leg cộng được. Con số km
dưới tên ngày tồn tại để người ta liếc qua và thấy tuyến đường có hợp lý không; một tổng
thiếu vài chặng vẫn trông như một tổng.

Cùng lý do, `parseDistanceMatrix` từ chối ma trận **sai kích thước** thay vì đoán dòng nào
thiếu, và một ô Goong không trả lời được là `null` chứ không phải `0` — `0` mét là một câu
trả lời thật (điểm đến chính nó).

### Toast phải nói vừa đo bằng gì

`optimizeRoute` chạy trên đường bộ hay chim bay cho ra hai thứ tự khác nhau mà **nhìn bằng
mắt không phân biệt được**. Nên nút *Tối ưu tuyến đường* nói rõ trong toast: "theo đường
bộ" hay "theo đường chim bay". Khi không có khoá Goong thì bỏ hẳn cụm đó — nói với người
chưa cấu hình gì rằng họ đang dùng đường chim bay là tiếng ồn.

## Gemini đi qua Vertex AI

`getAI(app, { backend })` trong `backend/firebase.js` chọn backend theo
`VITE_FIREBASE_AI_BACKEND`, **mặc định `vertex`**.

Điều dễ dẫm phải: firebase 12.18 đã **deprecate `VertexAIBackend`** và đổi tên đường đó
thành `AgentPlatformBackend` (Google đổi tên "Vertex AI Gemini API" thành "Agent
Platform"). Hai lớp cùng tới Vertex nhưng **mặc định vùng khác nhau** — `global` cho lớp
mới, `us-central1` cho lớp cũ. Code lấy `AgentPlatformBackend` trước, rơi về
`VertexAIBackend` nếu SDK chưa có, nên nó chạy được cả với SDK cũ hơn lẫn SDK sau này bỏ
hẳn lớp deprecated.

Vertex phục vụ model **theo vùng**, nên một model có thật vẫn 404 được ở vùng đã ghim.
`askModel` dịch riêng lỗi đó và nói ra cả tên model lẫn vùng, vì nếu không thì nó đọc y
như "gõ sai tên model". Bỏ trống `VITE_FIREBASE_AI_LOCATION` là dùng mặc định của SDK.

Vẫn nguyên luật cũ, không đổi theo backend: **mọi object lồng trong schema phải viết
`Schema.object({ properties: { … } })`**.

### Đã xác nhận tới đâu

Chạy trong trình duyệt với `.env.local` thật của project `nihon-speaking-29442-5f1db`:
`firebaseEnabled` true, `getAI` dựng ra **`AgentPlatformBackend`**, `backendType`
**`AGENT_PLATFORM`**, vùng **`global`**, và SDK 12.18 export cả hai lớp nên nhánh rơi về
`VertexAIBackend` chưa bao giờ chạy tới. App ra khỏi chế độ thử, màn đăng nhập Firebase
thật, không lỗi khởi tạo nào.

**Lượt gọi model thật thì chưa.** Hai thứ chặn, và không cái nào sửa được bằng code:

1. **Thiếu `VITE_FIREBASE_APPCHECK_SITE_KEY`.** `apps:sdkconfig` không trả về nó, và
   firebase-tools **không có nhóm lệnh `appcheck`** nào cả — chỉ lấy được từ Firebase
   Console → App Check. Project đang enforce, nên chưa có key thì Gemini trả 403.
2. **Phải đăng nhập bằng tài khoản thật.**

Nên nhánh Vertex mới chứng minh được tới lớp dựng backend, chưa tới câu trả lời của model.
Người đầu tiên có đủ hai thứ trên nên thử cả ba tính năng — Trợ lý AI, Cẩm nang, Dịch —
rồi cập nhật lại dòng này.

## Màn chuyến đi là một không gian, không phải một chồng tab

`Trip.jsx` dựng `.st-trip-shell`: **rail trái** (nút Trợ lý AI + các mục + danh sách ngày),
**cột giữa** (nội dung mục đang mở), và với mục Lịch trình thì `ItineraryTab` tự chia tiếp
thành danh sách + bản đồ (`.st-2col`).

Trước đây đây là năm tab, và mỗi tab giấu bốn tab kia: không đọc được lịch trình trong lúc
nói chuyện với trợ lý, còn chọn ngày thì phải tìm một hàng pill nằm lưng chừng trang. Giờ
**ngày nằm trong rail, dưới đúng mục của nó**, nên "tôi đang ở đâu" và "tôi đang xem ngày
nào" là cùng một câu hỏi. `state.day` vẫn là nguồn duy nhất, nên rail, lịch trình, bản đồ
và trợ lý không thể bất đồng.

Bản đồ và trợ lý **chỉ thuộc về mục Lịch trình**. Ngân sách và Thành viên là bảng rộng, ép
chúng vào một nửa màn hình để giữ bản đồ luôn hiện là đổi cái dùng được lấy cái nhất quán.

Ba cái bẫy đã dẫm phải khi dựng:

- **`min-width: 0` cho các track của grid.** Grid item mặc định `min-width: auto`, nên khi
  rail nằm xuống thành hàng ngang ở màn hẹp, một hàng nhãn không xuống dòng được đã thổi
  cả cột rộng ra và đẩy thanh cuộn ngang lên cả trang. Đo được bằng
  `documentElement.scrollWidth > clientWidth`.
- **`isolation: isolate` cho `.st-mapwrap`.** Leaflet dùng z-index tới 700 cho pane và 1000
  cho control, trong bất kỳ stacking context nào nó gặp — và nó đã vẽ đè lên panel trợ lý
  dán trên bản đồ. Nhốt thang z-index của Leaflet lại trong bản đồ, đừng đi đua z-index.
- **Panel trợ lý ghim vào cửa sổ, không vào bản đồ.** Bản đầu nó `position: absolute`
  trong khung bản đồ, nên nó thừa hưởng bề rộng của cột bản đồ — một cuộc trò chuyện bị
  bóp vào chỗ hẹp hơn chính những tin nhắn trong nó. Giờ `position: fixed` ở góc phải-dưới,
  rộng `min(430px, 100vw - 48px)`, và màn hẹp thì trải ngang thành một tấm dưới đáy.
  Nó cũng đứng yên khi lịch trình bên cạnh cuộn.

## Ảnh bìa lấy theo toạ độ, không lấy theo tên

Trước đây bìa chuyến đi là `picsum.photos/seed/<ngẫu nhiên>` — một ảnh ngẫu nhiên nhưng cố
định cho mỗi chuyến, trông có bố cục mà chẳng nói gì. Hai chuyến cùng đi Hội An ra hai tấm
ảnh không liên quan, và một chuyến vừa tạo từ bản nháp AI trông y hệt chuyến bên cạnh.

Giờ nó dùng thứ app đã có sẵn: **toạ độ**. `photoAnchor()` lấy điểm dừng đầu tiên có toạ độ
trong chuyến, rồi Wikipedia `generator=geosearch` trả về các bài viết quanh điểm đó kèm ảnh
đại diện. Bìa của một chuyến là ảnh của một nơi nằm trên chính chuyến đó.

**Tìm theo tên đã thử và đã bỏ.** Full-text search của Wikipedia trả lời "Đà Nẵng" bằng
"Quần đảo Hoàng Sa", còn `opensearch` trả lời bằng một bộ phim. Một toạ độ thì không đọc
nhầm kiểu đó được.

Bốn chi tiết:

- **`origin=*` là thứ làm nó chạy được từ trình duyệt.** Thiếu nó thì mọi request hỏng ở
  tầng fetch chứ không phải ở tầng parse, và triệu chứng là "không có ảnh" chứ không phải
  một lỗi CORS dễ đọc.
- **Gợi ý để chọn là tên điểm dừng, không phải tên chuyến.** "Đà Nẵng – Hội An" không khớp
  bài viết nào; "Biển Mỹ Khê" khớp đúng "Bãi biển Mỹ Khê". `words()` bỏ dấu và loại những từ
  mà nửa số địa danh Việt Nam đều có (bãi, chùa, cầu, núi…) để phần khớp còn lại có nghĩa.
- **Cache cả câu trả lời rỗng**, kèm TTL một ngày. Không có nó thì mỗi lần render một chuyến
  ở nơi Wikipedia chưa từng biết là thêm một request cho một câu trả lời không đổi.
  Wikipedia có chặn tốc độ với người gọi ẩn danh, và một cái bìa không đáng để retry.
- **Không có ảnh là một câu trả lời hợp lệ.** `.st-plate` vẽ sẵn gradient kèm đường đồng
  mức, nên chuyến chưa ghim điểm nào vẫn ra dáng. `Photo` giờ bỏ hẳn thẻ `<img>` khi `src`
  rỗng thay vì để nó lỗi rồi mới ẩn.

## Sổ tay dịch: ba ngôn ngữ, hai chiều, và giọng nói của trình duyệt

Trước đây là một chiều — tiếng Việt ra tám ngôn ngữ. Đó là hình dạng của một cuốn sổ tay,
không phải của một cuộc trò chuyện: người đối diện đáp lại một câu là tám ngôn ngữ một
chiều không chở nổi.

Ba chứ không phải tám vì một ngôn ngữ ở đây không chỉ là một cái chip: mỗi cái cần một
giọng trình duyệt đọc và nghe được, và một dòng `roman` có nghĩa. Thêm cái thứ tư là thêm
một dòng trong `LANGS` và kiểm xem thẻ speech có tồn tại không.

**`phraseKey` giờ mang cả hai đầu của chiều dịch.** `from` không phải trang trí: "no" từ
tiếng Anh sang Việt và "no" từ tiếng Nhật sang Việt là hai câu hỏi khác nhau với hai câu
trả lời khác nhau, mà một khoá chỉ có đích sẽ phục vụ câu này bằng câu trả lời của câu kia.
`cleanTranslation` mặc định `from: 'vi'` cho các mục ghi từ thời một chiều — hồi đó tất cả
đều là tiếng Việt đi ra, nên đó là câu trả lời đúng chứ không phải một cú đoán.

**Giọng nói đi bằng Web Speech API của chính trình duyệt**, không qua dịch vụ nào: không
cần khoá, và không có đoạn ghi âm cuộc trò chuyện của ai bị gửi đi đâu cả. Nhưng nó được
cài đặt không đều, và điều đó định hình cả thiết kế: **đọc thì trình duyệt nào cũng có,
nghe thì Chrome/Edge/Safari có còn Firefox thì không**. Nên `useSpeech.js` tách làm hai
hook, mỗi cái tự khai báo có chạy được không, và màn hình **ẩn nút** thay vì đưa ra một cái
bấm vào không xảy ra gì.

Hai chi tiết dễ quên:

- **Dọn dẹp lúc rời màn.** Một recogniser còn chạy giữ nguyên chỉ báo micro sau khi người
  dùng đã đi chỗ khác, và cái đó đọc ra là "ứng dụng đang nghe lén". `speechSynthesis` cũng
  phải `cancel()`, nếu không giọng đọc nói đè lên màn hình tiếp theo.
- **`speechSynthesis` có một hàng đợi cho cả trang.** Bấm nút hai lần phải là thay câu đang
  đọc, không phải xếp thêm một bản sao phía sau, nên `speak()` luôn `cancel()` trước.

## Hai trợ lý, hai việc khác nhau

`screens/AIDesk.jsx` viết một chuyến đi từ con số không. `screens/trip/AssistantTab.jsx`
sửa một chuyến đã có. Cùng gọi `askModel`, nhưng đừng gộp lại: cái sau phải nhét lịch
trình hiện tại vào prompt và **trả về đúng một ngày**, cái trước thì không có gì để nhét.

### Trợ lý trong chuyến là một cuộc trò chuyện, nhưng mục tiêu ghi thì không

`AssistantTab` là chat thật: bong bóng hai bên, Enter để gửi, lịch sử ở lại trên màn hình,
và `askAssistant` nhận `history` nên "thêm một quán nữa" biết "nữa" là gì.

Nhưng **ngày bị ghi vào là do chip chọn, không phải do câu chữ**. Đoán sai ý định trong một
câu tiếng Việt nghĩa là ghi đè lên một ngày không ai đang nói tới, và không có mức "giống
chat" nào đáng đổi lấy chuyện đó. Đổi ngày hay đổi chế độ thì **xoá luôn thread** — giữ lại
sẽ khiến "thêm một quán nữa" trỏ vào một ngày không còn là ngày sắp bị ghi.

**`reply` luôn có, `stops` thì không.** Đó là thứ biến cái này từ một cái form một ô thành
một cuộc trò chuyện: "quán nào ngon gần Cầu Rồng?" đáng được trả lời chứ không đáng bị
viết lại cả ngày, mà một schema lúc nào cũng đòi `stops` thì sẽ viết lại thật. `stops` rỗng
là tín hiệu "tôi nói, tôi không đề xuất" — không có cờ boolean riêng, vì cờ là thêm một thứ
nữa để model tự mâu thuẫn với chính nó.

**Đề xuất, không tự ghi.** Không có đường nào từ câu trả lời của model thẳng vào Firestore;
chỉ nút *Áp dụng* mới gọi `updateDay` / `addDay`. Một model sửa lịch trình tại chỗ là một
model lặng lẽ dời cái nhà hàng người ta đã đặt bàn. Áp dụng xong **không điều hướng đi đâu
cả** — thread là thứ đang có giá trị, mất nó để đổi một ngày là hỏng cả cuộc trò chuyện;
chỉ có một liên kết mời sang xem.

**Một ngày mỗi lần, có chủ ý.** Đưa cả chuyến rồi bảo "thêm một quán cà phê" thì model xếp
lại cả những ngày không ai hỏi tới, mà người bấm nút không thấy được cái gì vừa đổi.

**Nhãn "mới" là một cái diff**, và nó chụp lại ngày **tại thời điểm đề xuất** (`before` lưu
trong chính message). Nếu đọc ngày hiện tại thì sau khi áp dụng một đề xuất khác, các nhãn
cũ trong thread sẽ nói dối. Không có nó thì "Áp dụng" là một cú nhảy vào bóng tối, vì bản
trả về là **toàn bộ** danh sách chứ không phải phần thêm.

Ba chi tiết đi kèm:

- **Chế độ `add` gửi cả chuyến đi vào prompt**, không phải để sửa nó mà để ngày mới không
  lặp lại điểm dừng đã có. Chế độ `edit` chỉ gửi đúng ngày đang sửa.
- **Áp dụng tra lại ngày theo `id`, không theo chỉ số.** Giữa lúc đề xuất và lúc bấm, ngày
  đó có thể đã bị người khác xoá; ghi vào "thứ đang nằm ở chỉ số đó" là sửa nhầm ngày.
- **Tab này chỉ hiện với người có quyền sửa.** Mọi thứ nó làm đều kết thúc bằng một lần
  ghi, nên với người chỉ xem thì đó là một màn hình toàn nút sẽ báo lỗi. `tripTab` được
  nhớ giữa các chuyến, nên `Trip.jsx` phải rơi về `itin` khi tab đang nhớ không còn tồn
  tại — nếu không, người chỉ xem gặp một trang trắng dưới thanh tab.

### Form của bàn soạn: hai ngày, và một con số gõ tay

`aiDaysN` đã bị bỏ. Số ngày **suy ra** từ ngày khởi hành và ngày kết thúc bằng
`dayCountBetween()` trong `data.js` — đếm cả hai đầu, 12/09→15/09 là **4** ngày. Giữ số
ngày thành một trường riêng nghĩa là nó có ngày lệch với chính hai cái ngày được ghi vào
chuyến đi ngay sau đó.

`AI_MAX_DAYS` (14) chặn **một lần soạn**, không chặn độ dài chuyến đi: quá hai tuần thì
model thôi viết lịch trình và bắt đầu viết brochure. Muốn dài hơn thì thêm ngày bằng trợ
lý trong chuyến.

Số người là **ô nhập**, và hàng chip "Đi cùng" đã bị bỏ hẳn. Trước đây "Nhóm bạn" âm thầm
là bốn người và ngân sách cả nhóm tính từ con số đoán đó; khi số người đã thành một trường
riêng thì hàng chip là câu trả lời thứ hai cho một câu hỏi đã có câu trả lời rồi.

Chip **"Khác…"** không nằm trong `STYLE_CHIPS`, để nó không bao giờ bị gửi đi như một
phong cách. Bật nó mới hiện ô chữ, và bật mà bỏ trống thì form chặn lại trước khi tốn một
lượt gọi model.

## Những chỗ đã sập — đừng dẫm lại

**`Number(null)` là `0`, và `0` là một toạ độ hợp lệ.** `cleanStop` từng viết
`coord = (v) => Number.isFinite(Number(v)) ? Number(v) : null`. `newStop()` sinh ra
`lat: null, lng: null`, ghi thẳng vào Firestore, đọc lại thành **`lat: 0, lng: 0`** —
`hasCoords()` trả `true`, và **mọi điểm dừng thêm tay bị ghim ngoài khơi châu Phi** rồi
kéo cả `optimizeRoute` theo, trong khi giao diện vẫn nói "chưa có toạ độ". Chỉ lộ ra sau
một lần tải lại trang, vì trong bộ nhớ giá trị vẫn là `null`.

Bài học rộng hơn: `num()` dùng chung được vì fallback của nó *là* 0, còn toạ độ thì
"thiếu" và "bằng 0" là hai câu trả lời khác nhau — trường nào như vậy phải có bộ đọc
riêng. Giờ `coord()` chỉ nhận `number` hoặc chuỗi chứa số, kèm kiểm tra biên ±90/±180.
Có ca test trong `tests/unit/schema.test.mjs` ghim đúng cảnh này.

**`firebase/ai` phải nằm trong `optimizeDeps.include`.** Nó chỉ được `import()` động nên
Vite không thấy khi quét import tĩnh lúc khởi động; nó sẽ phát hiện muộn lúc chạy, tái
tối ưu, đổi `browserHash`, và request đang bay thành 404:
`Failed to fetch dynamically imported module`. Đã khai báo trong `vite.config.js` — đừng gỡ.

**`Schema.object` phải bọc `properties:`, kể cả object lồng bên trong.** Viết
`Schema.object({ place: ... })` thay vì `Schema.object({ properties: { place: ... } })`
làm Gemini trả `400 Unknown name "place"`. Lỗi này từng lọt vì ở object ngoài cùng viết
đúng, hai cái lồng trong thì quên.

**Đường Firebase thật rất khác đường mock.** Cả hai lỗi trên đều chỉ lộ ra sau khi có
`.env.local`; trước đó Trợ lý AI luôn đi nhánh mock nên không bao giờ chạy tới. Sửa gì
trong `backend/ai.js` thì phải thử với config thật, không chỉ chế độ thử.

**Bundler không bắt biến chưa khai báo.** Một lần `sed` xoá nhầm dòng khai báo trong
`firestore.js`, `vite build` vẫn xanh, chỉ nổ lúc chạy — mà đúng vào đường không test
được. Đó là lý do có ESLint. Chạy `npm run lint` trước khi commit.

**Không được ghi trip và subcollection của nó trong cùng một batch.** Rule của
`days`/`expenses` `get()` document trip cha để tra quyền; trong cùng batch thì cha
**chưa tồn tại**, nên mọi ghi lồng bên trong bị `permission-denied`. `createTrip` phải
`setDoc` trip trước và await, rồi mới batch phần còn lại. Dấu hiệu nhận ra: tạo chuyến
**rỗng** thì được, tạo chuyến **có ngày** thì hỏng.

**Firestore giết listener vĩnh viễn khi nó lỗi — phải tự gắn lại.** Listener `days` của
một chuyến vừa tạo có thể lỗi ngay lúc gắn (rule đọc cha, server chưa thấy cha), và sau
đó nó chết luôn: ngày nằm trong Firestore nhưng app hiện rỗng cho tới khi tải lại trang.
`subscribeTrips` giờ bỏ listener lỗi rồi gắn lại tối đa 3 lần.

**Snapshot từ cache không phải bằng chứng đã hết lỗi.** Sau một lỗi quyền, Firestore vẫn
trả dữ liệu cache như một snapshot thành công. Trước đây nó xoá mất `dataError` và app
hiện dữ liệu cũ như không có chuyện gì. Giờ chỉ xoá `dataError` khi
`snap.metadata.fromCache` là false.

**Rules cho truy vấn danh sách khác rules cho đọc một document.** Firestore xét `list`
theo **chính truy vấn**, không theo từng document nó sẽ trả về. Bộ test lúc đầu chỉ dùng
`getDoc` nên pass hết, trong khi app thật dùng `getDocs(query(...))` và bị chặn. Thêm
tính năng đọc nào thì test đúng cái lời gọi mà client dùng.

**Xoá cha trước là mất luôn quyền xoá con.** Firestore không cascade, mà rule của
`days`/`expenses` `get()` document trip cha để tra quyền — cha mất thì `get()` trả null,
rule lỗi, và **mọi thao tác đọc/ghi/xoá lên phần con bị từ chối vĩnh viễn**. Bản
`deleteTrip` đầu tiên chỉ `deleteDoc(tripRef)`, để lại ngày và khoản chi mồ côi mà không
client nào chạm được nữa. Đã dựng lại đúng cảnh đó trên emulator. Giờ `deleteTrip` lấy
hết con, xoá theo lô (trần batch là 500), **rồi mới** xoá cha. Quy tắc chung: cái gì
`get()` lên cha để tra quyền thì phải chết trước cha.

**Test pass hết không có nghĩa là rules kín.** Bộ test 20 ca pass 20/20 trong khi ba lỗ
`members`/`pendingEmails` ở trên vẫn mở toang — vì không ca nào chạm tới hai trường đó.
Thêm nhánh nào vào rules thì viết ca cho **đúng trường** nhánh đó không bảo vệ, đừng chỉ
test những trường đã nghĩ tới.

**Dev server cache module cũ sau khi đổi export.** Thêm export mới vào một file đang
được import mà HMR báo `does not provide an export named ...` thì restart dev server,
đừng đi tìm lỗi cú pháp không có thật.

---

## Git

Nhánh làm việc đổi theo từng phiên (gần nhất: `claude/goong-gemini-map-planning-94785c`),
merge vào `main` bằng fast-forward. `main` được checkout ở `E:/Git/SmartTrip2` — **kiểm tra worktree đó sạch
trước khi merge**, đã từng có một phiên khác để công việc dở dang ở đấy.

Worktree phụ nằm trong `.claude/worktrees/`. Mỗi cái cần `npm install` riêng — chúng
không dùng chung `node_modules` với `E:/Git/SmartTrip2`.
