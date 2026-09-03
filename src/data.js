/* Seed data + shared formatting helpers.
   Every entity carries a stable `id`: expenses point at a member by `payerId`
   and stops/days are keyed by id, so reordering or removing a row can never
   silently re-attach a cost to the wrong person. */

let seq = 0;
export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const CATEGORIES = ['Đi lại', 'Lưu trú', 'Ăn uống', 'Vé tham quan', 'Khác'];

/* The space before ₫ is a non-breaking one, and that is the whole point: with
   an ordinary space the browser is free to wrap there, and in a narrow card it
   did — "16.000.000" on one line and a lone "₫" on the next, which reads as a
   layout accident every time. One character here fixes it in the stat tiles,
   the tags, the expense table and the printed sheet at once. */
export const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} ₫`;
export const first = (name) => String(name || '').trim().split(/\s+/)[0] || '—';

/* Photo helper — seeded so each place keeps the same image between renders.
   Every plate has a gradient underlay, so a blocked request still looks composed. */
export const photo = (seed, w = 1200, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/* ── date helpers ───────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, '0');

export const parseISO = (s) => {
  if (typeof s !== 'string') return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "12 – 15/09/2026" — collapses the shared month/year the way a person writes it. */
export function formatRange(startISO, endISO) {
  const a = parseISO(startISO);
  const b = parseISO(endISO) || a;
  if (!a) return 'Chưa chọn ngày';
  if (a.getTime() === b.getTime()) return `${pad(a.getDate())}/${pad(a.getMonth() + 1)}/${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) {
    return `${pad(a.getDate())}/${pad(a.getMonth() + 1)}/${a.getFullYear()} – ${pad(b.getDate())}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${pad(a.getDate())}/${pad(a.getMonth() + 1)} – ${pad(b.getDate())}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`;
  }
  return `${pad(a.getDate())} – ${pad(b.getDate())}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`;
}

const DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "Thứ Bảy 12/09" for the n-th day of a trip; falls back when there are no dates. */
export function dayLabel(startISO, index) {
  const a = parseISO(startISO);
  if (!a) return `Ngày ${index + 1}`;
  const d = new Date(a.getTime());
  d.setDate(d.getDate() + index);
  return `${DOW[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Whole days from today until departure; null when the trip has no start date. */
export function daysUntil(startISO) {
  const a = parseISO(startISO);
  if (!a) return null;
  return Math.round((a.getTime() - startOfToday().getTime()) / 86400000);
}

/* ── derived trip facts — computed, never stored, so they cannot go stale ── */

export const stopCount = (trip) => trip.days.reduce((s, d) => s + d.items.length, 0);
export const tripTotal = (trip) => trip.expenses.reduce((s, e) => s + e.amount, 0);
export const hasCoords = (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng);

/** draft → nothing planned yet · past → already travelled · upcoming → the rest */
export function tripStatus(trip) {
  if (stopCount(trip) === 0) return 'draft';
  const end = parseISO(trip.endDate) || parseISO(trip.startDate);
  if (end && end < startOfToday()) return 'past';
  return 'upcoming';
}

export const STATUS_LABEL = {
  draft: { label: 'Nháp', cls: 'tag-neutral' },
  past: { label: 'Đã đi', cls: 'tag-neutral' },
  upcoming: { label: 'Sắp tới', cls: 'tag-accent' },
};

/* ── factories ──────────────────────────────────────────────────────────── */

export const newStop = (over = {}) => ({
  id: uid('stop'), time: '09:00', name: '', note: '', cost: 0, lat: null, lng: null, ...over,
});

export const newDay = (over = {}) => ({ id: uid('day'), place: '', items: [], ...over });

export const newTrip = (over = {}) => ({
  id: uid('trip'),
  title: 'Chuyến đi mới',
  seed: `trip-${Math.random().toString(36).slice(2, 8)}`,
  alt: 'Ảnh bìa chuyến đi',
  body: 'Chưa có mô tả. Thêm ngày và điểm dừng để bắt đầu.',
  startDate: null,
  endDate: null,
  plan: 0,
  days: [],
  expenses: [],
  /* A placeholder seat, not a person. createTrip replaces the identity on it
     with whoever is signed in — it exists at all because cleanTrip drops a trip
     with no members, so the factory cannot hand back an empty list. It used to
     carry a name and gmail address copied from the mockups, which was one
     forgotten overwrite away from shipping a stranger's address as a member. */
  members: [{ id: uid('mem'), name: 'Chủ chuyến đi', email: 'owner@smarttrip.local', role: 'owner' }],
  settled: {},
  ...over,
});

/* ── seed trips ─────────────────────────────────────────────────────────── */

const DANANG = {
  id: 'dnha',
  title: 'Đà Nẵng – Hội An',
  seed: 'hoian-lanterns',
  alt: 'Đèn lồng phố cổ Hội An lúc chập tối',
  body: 'Bốn ngày dọc bờ biển miền Trung: Mỹ Khê, Bà Nà, rồi thả đèn trên sông Hoài. Lịch ngày 1–4 đã chốt với cả nhóm.',
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  plan: 16000000,
  settled: {},
  members: [
    { id: 'dn-m1', name: 'Minh Trần', email: 'minh.tran@gmail.com', role: 'owner' },
    { id: 'dn-m2', name: 'Lan Phạm', email: 'lan.pham@gmail.com', role: 'edit' },
    { id: 'dn-m3', name: 'Huy Lê', email: 'huy.le@gmail.com', role: 'edit' },
    { id: 'dn-m4', name: 'An Nguyễn', email: 'an.nguyen@gmail.com', role: 'view' },
  ],
  days: [
    {
      id: 'dn-d1', place: 'Đà Nẵng', seed: 'danang-mykhe',
      items: [
        { id: 'dn-s1', time: '08:30', name: 'Biển Mỹ Khê', note: 'Tắm biển sớm, thuê ghế + cà phê', cost: 40000, lat: 16.0611, lng: 108.2467 },
        { id: 'dn-s2', time: '10:30', name: 'Bảo tàng Điêu khắc Chăm', note: 'Vé 60.000 ₫/người ×4', cost: 240000, lat: 16.0605, lng: 108.2232 },
        { id: 'dn-s3', time: '12:30', name: 'Bún chả cá Hờn', note: 'Ăn trưa · gọi thêm chả cuốn', cost: 160000, lat: 16.0668, lng: 108.2213 },
        { id: 'dn-s4', time: '15:30', name: 'Chùa Linh Ứng – Sơn Trà', note: 'Miễn phí · mặc lịch sự, mang nước', cost: 0, lat: 16.1004, lng: 108.2775 },
        { id: 'dn-s5', time: '18:30', name: 'Hải sản Bé Mặn', note: 'Đặt bàn trước 1 ngày · món ghẹ', cost: 850000, lat: 16.0790, lng: 108.2462 },
      ],
    },
    {
      id: 'dn-d2', place: 'Bà Nà Hills', seed: 'bana-goldenbridge',
      items: [
        { id: 'dn-s6', time: '07:30', name: 'Bà Nà Hills – Cầu Vàng', note: 'Cáp treo ×4 · đi sớm tránh đông', cost: 3400000, lat: 15.9977, lng: 107.9970 },
        { id: 'dn-s7', time: '11:30', name: 'Buffet Làng Pháp', note: 'Trong khu Bà Nà · giữ vé cáp treo', cost: 960000, lat: 15.9990, lng: 107.9945 },
        { id: 'dn-s8', time: '19:00', name: 'Chợ đêm Sơn Trà', note: 'Ăn vặt + xem Cầu Rồng', cost: 300000, lat: 16.0618, lng: 108.2306 },
      ],
    },
    {
      id: 'dn-d3', place: 'Hội An', seed: 'hoian-lanterns',
      items: [
        { id: 'dn-s9', time: '06:00', name: 'Bình minh An Bàng', note: 'Đi Hội An sớm · gửi xe 10k', cost: 0, lat: 15.9107, lng: 108.3384 },
        { id: 'dn-s10', time: '09:30', name: 'Phố cổ Hội An', note: 'Vé tham quan gộp + đèn lồng', cost: 320000, lat: 15.8774, lng: 108.3273 },
        { id: 'dn-s11', time: '12:00', name: 'Cơm gà Bà Buội', note: 'Đông vào trưa · đi trước 11h45', cost: 200000, lat: 15.8776, lng: 108.3266 },
        { id: 'dn-s12', time: '19:30', name: 'Thả đèn sông Hoài', note: 'Thuyền 30 phút · trả giá nhẹ', cost: 100000, lat: 15.8766, lng: 108.3297 },
      ],
    },
    {
      id: 'dn-d4', place: 'Trở về', seed: 'danang-hanriver',
      items: [
        { id: 'dn-s13', time: '08:00', name: 'Cà phê bên sông Hàn', note: 'Trả phòng trước 12h', cost: 120000, lat: 16.0672, lng: 108.2247 },
        { id: 'dn-s14', time: '10:00', name: 'Chợ Hàn – mua quà', note: 'Mực rim, tré, bánh khô mè', cost: 500000, lat: 16.0682, lng: 108.2244 },
        { id: 'dn-s15', time: '13:40', name: 'Sân bay Đà Nẵng — bay về', note: 'Taxi 20 phút · VJ 631 · cất cánh 15:05', cost: 180000, lat: 16.0439, lng: 108.1994 },
      ],
    },
  ],
  expenses: [
    { id: 'dn-e1', name: 'Vé máy bay khứ hồi ×4', cat: 'Đi lại', payerId: 'dn-m1', amount: 4800000 },
    { id: 'dn-e2', name: 'Khách sạn 3 đêm · 2 phòng', cat: 'Lưu trú', payerId: 'dn-m2', amount: 3600000 },
    { id: 'dn-e3', name: 'Vé Bà Nà Hills ×4', cat: 'Vé tham quan', payerId: 'dn-m3', amount: 3400000 },
    { id: 'dn-e4', name: 'Ăn uống ngày 1–3', cat: 'Ăn uống', payerId: 'dn-m1', amount: 2150000 },
    { id: 'dn-e5', name: 'Thuê xe máy + taxi', cat: 'Đi lại', payerId: 'dn-m4', amount: 640000 },
    { id: 'dn-e6', name: 'Vé phố cổ + hoa đăng', cat: 'Vé tham quan', payerId: 'dn-m2', amount: 320000 },
  ],
};

const DALAT = {
  id: 'dalat',
  title: 'Đà Lạt cuối tuần',
  seed: 'dalat-pines',
  alt: 'Đồi thông Đà Lạt trong sương sớm',
  body: 'Mới có ngày đi và hai người xác nhận. Chưa thêm điểm dừng nào.',
  startDate: '2026-11-07',
  endDate: '2026-11-09',
  plan: 0,
  days: [],
  expenses: [],
  settled: {},
  members: [
    { id: 'dl-m1', name: 'Minh Trần', email: 'minh.tran@gmail.com', role: 'owner' },
    { id: 'dl-m2', name: 'Lan Phạm', email: 'lan.pham@gmail.com', role: 'edit' },
  ],
};

const BANGKOK = {
  id: 'bkk',
  title: 'Bangkok ăn sập',
  seed: 'bangkok-street',
  alt: 'Hàng quán ven đường Bangkok về đêm',
  body: 'Chuyến đã đi hồi tháng 3. Mọi khoản chi đã ghi đủ, giữ lại làm sổ kỷ niệm.',
  startDate: '2026-03-14',
  endDate: '2026-03-18',
  plan: 30000000,
  settled: {},
  members: [
    { id: 'bk-m1', name: 'Minh Trần', email: 'minh.tran@gmail.com', role: 'owner' },
    { id: 'bk-m2', name: 'Lan Phạm', email: 'lan.pham@gmail.com', role: 'edit' },
    { id: 'bk-m3', name: 'Huy Lê', email: 'huy.le@gmail.com', role: 'edit' },
    { id: 'bk-m4', name: 'An Nguyễn', email: 'an.nguyen@gmail.com', role: 'edit' },
    { id: 'bk-m5', name: 'Thảo Vũ', email: 'thao.vu@gmail.com', role: 'view' },
  ],
  days: [
    {
      id: 'bk-d1', place: 'Chợ & phố cổ', seed: 'bangkok-chatuchak',
      items: [
        { id: 'bk-s1', time: '09:30', name: 'Chợ cuối tuần Chatuchak', note: 'Đi BTS tới Mo Chit · mặc cả một nửa', cost: 400000, lat: 13.7999, lng: 100.5504 },
        { id: 'bk-s2', time: '13:00', name: 'Wat Arun', note: 'Qua sông bằng phà 4 baht', cost: 200000, lat: 13.7437, lng: 100.4889 },
        { id: 'bk-s3', time: '16:00', name: 'Wat Pho', note: 'Tượng Phật nằm · nhớ mặc kín vai', cost: 200000, lat: 13.7465, lng: 100.4927 },
        { id: 'bk-s4', time: '19:00', name: 'Phố ăn đêm Yaowarat', note: 'Hải sản nướng + chè hạt sen', cost: 900000, lat: 13.7398, lng: 100.5106 },
      ],
    },
    {
      id: 'bk-d2', place: 'Sông Chao Phraya', seed: 'bangkok-river',
      items: [
        { id: 'bk-s5', time: '08:30', name: 'Cung điện Hoàng gia', note: 'Vé 500 baht/người ×5', cost: 2000000, lat: 13.7500, lng: 100.4913 },
        { id: 'bk-s6', time: '12:00', name: 'Thuyền kênh Bangkok Noi', note: 'Thuê nguyên thuyền một giờ', cost: 800000, lat: 13.7563, lng: 100.4844 },
        { id: 'bk-s7', time: '15:30', name: 'ICONSIAM', note: 'Chợ nổi trong nhà · tránh nắng trưa', cost: 300000, lat: 13.7263, lng: 100.5100 },
        { id: 'bk-s8', time: '19:30', name: 'Asiatique The Riverfront', note: 'Phà miễn phí từ bến Sathorn', cost: 700000, lat: 13.7043, lng: 100.5030 },
      ],
    },
    {
      id: 'bk-d3', place: 'Trung tâm Siam', seed: 'bangkok-siam',
      items: [
        { id: 'bk-s9', time: '10:00', name: 'Nhà Jim Thompson', note: 'Tour tiếng Anh mỗi 30 phút', cost: 500000, lat: 13.7494, lng: 100.5281 },
        { id: 'bk-s10', time: '12:30', name: 'MBK Center', note: 'Mua quà · ăn trưa food court tầng 6', cost: 1200000, lat: 13.7447, lng: 100.5300 },
        { id: 'bk-s11', time: '16:00', name: 'Đền Erawan', note: 'Miễn phí · xem múa cúng', cost: 0, lat: 13.7443, lng: 100.5406 },
        { id: 'bk-s12', time: '18:30', name: 'Rooftop Vertigo', note: 'Có dress code · đặt bàn trước', cost: 1500000, lat: 13.7226, lng: 100.5460 },
      ],
    },
    {
      id: 'bk-d4', place: 'Ayutthaya', seed: 'ayutthaya-ruins',
      items: [
        { id: 'bk-s13', time: '09:00', name: 'Cố đô Ayutthaya', note: 'Thuê xe cả ngày · đi từ 7h cho mát', cost: 1800000, lat: 14.3559, lng: 100.5772 },
        { id: 'bk-s14', time: '18:00', name: 'Massage Thái Sukhumvit', note: 'Giãn chân sau một ngày đi bộ', cost: 600000, lat: 13.7380, lng: 100.5600 },
      ],
    },
    {
      id: 'bk-d5', place: 'Bay về', seed: 'bangkok-airport',
      items: [
        { id: 'bk-s15', time: '11:00', name: 'Sân bay Suvarnabhumi', note: 'Airport Rail Link · cất cánh 14:20', cost: 350000, lat: 13.6900, lng: 100.7501 },
      ],
    },
  ],
  expenses: [
    { id: 'bk-e1', name: 'Vé máy bay khứ hồi ×5', cat: 'Đi lại', payerId: 'bk-m1', amount: 12500000 },
    { id: 'bk-e2', name: 'Khách sạn 4 đêm · 2 phòng', cat: 'Lưu trú', payerId: 'bk-m2', amount: 7200000 },
    { id: 'bk-e3', name: 'Ăn uống cả chuyến', cat: 'Ăn uống', payerId: 'bk-m3', amount: 4300000 },
    { id: 'bk-e4', name: 'BTS, taxi và thuê xe Ayutthaya', cat: 'Đi lại', payerId: 'bk-m4', amount: 1900000 },
    { id: 'bk-e5', name: 'Vé tham quan cả nhóm', cat: 'Vé tham quan', payerId: 'bk-m5', amount: 2500000 },
  ],
};

export const SEED_TRIPS = [DANANG, DALAT, BANGKOK];
