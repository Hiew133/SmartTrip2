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
| Firebase AI Logic (Gemini) | ❌ **bị khoá tới khi enforce App Check** |
| Test Security Rules | ❌ **chưa từng chạy** (xem "Đang vướng") |

---

## App Check — việc còn dở

Firebase từ chối phục vụ AI Logic cho project chưa enforce App Check:

```
403 ... you must enforce Firebase App Check
```

Auth và Firestore vẫn chạy bình thường, chỉ Trợ lý AI bị khoá.

### Chọn provider nào

Màn đăng ký trong Console cho hai lựa chọn. **Chọn `reCAPTCHA` (cái dưới), không phải
`reCAPTCHA Enterprise` (cái trên).**

| | reCAPTCHA (v3 classic) | reCAPTCHA Enterprise |
|---|---|---|
| Chi phí | Miễn phí | Cần bật billing trên Google Cloud |
| Tạo khoá ở | [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create) | Google Cloud Console → reCAPTCHA Enterprise |
| Firebase hỏi khoá nào | **Secret key** | **Site key** |
| Env cần đặt | `VITE_FIREBASE_APPCHECK_SITE_KEY` | thêm `VITE_FIREBASE_APPCHECK_ENTERPRISE=true` |

Code hỗ trợ cả hai (`backend/firebase.js` → `attachAppCheck`), nhưng v3 classic đơn
giản hơn và không cần thẻ.

### Các bước (v3 classic)

1. [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create)
   → loại **reCAPTCHA v3** → domain `localhost` (+ domain deploy nếu có) → nhận **2 khoá**.
2. Console → **App Check → Apps → SmartTrip** → bấm **+** ở dòng `reCAPTCHA` (dòng dưới
   cùng, không phải Enterprise) → dán **secret key** → Save.
3. `.env.local`: `VITE_FIREBASE_APPCHECK_SITE_KEY=<site key>`
4. `npm run dev` → mở Console trình duyệt, app tự in **debug token** (UUID) → copy vào
   **App Check → Apps → ⋮ → Manage debug tokens**. Thiếu bước này thì localhost bị chặn.
5. **App Check → APIs** → **Enforce** cho *Firebase AI Logic*.

> **Site key công khai, secret key thì không.** Site key nằm sẵn trong mọi trang dùng
> reCAPTCHA nên vào `.env.local` là bình thường. Secret key chỉ dán vào Console, không
> bao giờ vào code, `.env`, hay chat.

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

**Dev server cache module cũ sau khi đổi export.** Thêm export mới vào một file đang
được import mà HMR báo `does not provide an export named ...` thì restart dev server,
đừng đi tìm lỗi cú pháp không có thật.

---

## Git

Nhánh làm việc: `claude/project-review-issues-4529a4`, merge vào `main` bằng
fast-forward. `main` được checkout ở `E:/Git/SmartTrip2` — **kiểm tra worktree đó sạch
trước khi merge**, đã từng có một phiên khác để công việc dở dang ở đấy.
