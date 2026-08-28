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
npm run test:rules # kiểm thử Security Rules trên emulator (xem mục "Đang vướng")
```

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
| Test Security Rules | ❌ **chưa từng chạy** (xem "Đang vướng") |

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

### Test Security Rules chưa chạy được

`tests/firestore-rules.test.mjs` có 9 ca, gồm cả "editor tự nâng quyền" và "editor tự
thêm ghế thành viên". `firebase emulators` đòi **JDK 21**, máy hiện có **JDK 17**.

Rules đang deploy và đã xác nhận chặn người lạ (đọc `trips/` không token → 403), nhưng
các nhánh còn lại **mới chỉ đúng trên giấy**. Cài JDK 21 rồi chạy `npm run test:rules`
trước khi mở app cho người ngoài dùng.

### Lời mời chưa thật sự mời ai

`addMember` chỉ ghi một thành viên `pending: true` với `uid: null` vào chuyến đi. Không
có email nào được gửi, và người được mời **chưa đọc được chuyến đi** vì Rules xét theo
`memberIds` mà họ chưa có `uid` trong đó. Cần một Cloud Function đối chiếu email với
tài khoản rồi điền `uid` vào ghế tương ứng. Chừng nào chưa có, cộng tác nhóm chưa chạy
với người thật.

### Khác

- Liên kết chia sẻ `/t/{tripId}` chưa có route xử lý; app chưa có router.
- Kéo-thả dùng HTML5 drag & drop nên chưa chạy trên cảm ứng, chưa có cách sắp xếp bằng bàn phím.
- Trong Browser pane lúc kiểm thử, `net::ERR_CONNECTION_REFUSED` là do môi trường chặn
  host ngoài (ảnh picsum, tile OpenStreetMap, Google Fonts) — không phải lỗi app.
- `npm run lint` còn 3 cảnh báo `react-hooks/set-state-in-effect` có sẵn từ trước
  (animation vào màn, toast, count-up). Đã để mức `warn` có chủ ý, không phải bỏ sót.

---

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

**Dev server cache module cũ sau khi đổi export.** Thêm export mới vào một file đang
được import mà HMR báo `does not provide an export named ...` thì restart dev server,
đừng đi tìm lỗi cú pháp không có thật.

---

## Git

Nhánh làm việc: `claude/project-review-issues-4529a4`, merge vào `main` bằng
fast-forward. `main` được checkout ở `E:/Git/SmartTrip2` — **kiểm tra worktree đó sạch
trước khi merge**, đã từng có một phiên khác để công việc dở dang ở đấy.
