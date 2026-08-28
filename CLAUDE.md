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
npm run test:rules # kiểm thử Security Rules trên emulator — 27 ca
```

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
| App Check (reCAPTCHA Enterprise) | ✅ đã enforce, debug token localhost đã đăng ký |
| Test Security Rules | ✅ 27/27 pass trên emulator |
| Nhận lời mời | ✅ tự nhận ghế khi đăng nhập (cần email đã xác minh) |
| Gỡ / rời thành viên | ✅ chủ gỡ được người khác và huỷ được lời mời; người khác tự rời được |
| Xoá chuyến đi | ✅ chủ xoá được, xoá luôn `days` và `expenses` |
| Liên kết chia sẻ `/t/{id}` | ✅ mở đúng chuyến, giữ được qua bước đăng nhập |

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

- Kéo-thả dùng HTML5 drag & drop nên chưa chạy trên cảm ứng, chưa có cách sắp xếp bằng bàn phím.
- Trong Browser pane lúc kiểm thử, `net::ERR_CONNECTION_REFUSED` là do môi trường chặn
  host ngoài (ảnh picsum, tile OpenStreetMap, Google Fonts) — không phải lỗi app.
- `npm run lint` còn **5** cảnh báo `react-hooks/set-state-in-effect` có sẵn từ trước
  (animation vào màn, toast, count-up). Đã để mức `warn` có chủ ý, không phải bỏ sót.
- `npm run build` còn cảnh báo chunk >500 kB, trên `firebase-firestore` (567 kB). Split
  thêm không giải quyết được; chỉ có cách không ship nó, mà `backend/index.js` import
  tĩnh cả hai repository để chọn một. Xem chú thích trong `vite.config.js`.

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

## Những chỗ đã sập — đừng dẫm lại

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

Nhánh làm việc: `claude/project-review-action-items-aed835`, merge vào `main` bằng
fast-forward. `main` được checkout ở `E:/Git/SmartTrip2` — **kiểm tra worktree đó sạch
trước khi merge**, đã từng có một phiên khác để công việc dở dang ở đấy.

Worktree phụ nằm trong `.claude/worktrees/`. Mỗi cái cần `npm install` riêng — chúng
không dùng chung `node_modules` với `E:/Git/SmartTrip2`.
