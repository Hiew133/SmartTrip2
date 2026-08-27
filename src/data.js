// Seed data for the Đà Nẵng – Hội An demo trip (from the SmartTrip design project).

export const PLAN = 16000000;

/* Photo helper — seeded so each place keeps the same image between renders.
   Every plate has a gradient underlay, so a blocked request still looks composed. */
export const photo = (seed, w = 1200, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const SEED_DAYS = [
  {
    place: 'Đà Nẵng', dow: 'Thứ Bảy 12/09', seed: 'danang-mykhe',
    items: [
      { t: '08:30', n: 'Biển Mỹ Khê', note: 'Tắm biển sớm, thuê ghế + cà phê', c: 40000, lat: 16.0611, lng: 108.2467 },
      { t: '10:30', n: 'Bảo tàng Điêu khắc Chăm', note: 'Vé 60.000 ₫/người ×4', c: 240000, lat: 16.0605, lng: 108.2232 },
      { t: '12:30', n: 'Bún chả cá Hờn', note: 'Ăn trưa · gọi thêm chả cuốn', c: 160000, lat: 16.0668, lng: 108.2213 },
      { t: '15:30', n: 'Chùa Linh Ứng – Sơn Trà', note: 'Miễn phí · mặc lịch sự, mang nước', c: 0, lat: 16.1004, lng: 108.2775 },
      { t: '18:30', n: 'Hải sản Bé Mặn', note: 'Đặt bàn trước 1 ngày · món ghẹ', c: 850000, lat: 16.0790, lng: 108.2462 },
    ],
  },
  {
    place: 'Bà Nà Hills', dow: 'Chủ Nhật 13/09', seed: 'bana-goldenbridge',
    items: [
      { t: '07:30', n: 'Bà Nà Hills – Cầu Vàng', note: 'Cáp treo ×4 · đi sớm tránh đông', c: 3400000, lat: 15.9977, lng: 107.9970 },
      { t: '11:30', n: 'Buffet Làng Pháp', note: 'Trong khu Bà Nà · giữ vé cáp treo', c: 960000, lat: 15.9990, lng: 107.9945 },
      { t: '19:00', n: 'Chợ đêm Sơn Trà', note: 'Ăn vặt + xem Cầu Rồng', c: 300000, lat: 16.0618, lng: 108.2306 },
    ],
  },
  {
    place: 'Hội An', dow: 'Thứ Hai 14/09', seed: 'hoian-lanterns',
    items: [
      { t: '06:00', n: 'Bình minh An Bàng', note: 'Đi Hội An sớm · gửi xe 10k', c: 0, lat: 15.9107, lng: 108.3384 },
      { t: '09:30', n: 'Phố cổ Hội An', note: 'Vé tham quan gộp + đèn lồng', c: 320000, lat: 15.8774, lng: 108.3273 },
      { t: '12:00', n: 'Cơm gà Bà Buội', note: 'Đông vào trưa · đi trước 11h45', c: 200000, lat: 15.8776, lng: 108.3266 },
      { t: '19:30', n: 'Thả đèn sông Hoài', note: 'Thuyền 30 phút · trả giá nhẹ', c: 100000, lat: 15.8766, lng: 108.3297 },
    ],
  },
  {
    place: 'Trở về', dow: 'Thứ Ba 15/09', seed: 'danang-hanriver',
    items: [
      { t: '08:00', n: 'Cà phê bên sông Hàn', note: 'Trả phòng trước 12h', c: 120000, lat: 16.0672, lng: 108.2247 },
      { t: '10:00', n: 'Chợ Hàn – mua quà', note: 'Mực rim, tré, bánh khô mè', c: 500000, lat: 16.0682, lng: 108.2244 },
      { t: '13:40', n: 'Sân bay Đà Nẵng — bay về', note: 'Taxi 20 phút · VJ 631 · cất cánh 15:05', c: 180000, lat: 16.0439, lng: 108.1994 },
    ],
  },
];

export const SEED_EXPENSES = [
  { n: 'Vé máy bay khứ hồi ×4', cat: 'Đi lại', p: 0, a: 4800000 },
  { n: 'Khách sạn 3 đêm · 2 phòng', cat: 'Lưu trú', p: 1, a: 3600000 },
  { n: 'Vé Bà Nà Hills ×4', cat: 'Vé tham quan', p: 2, a: 3400000 },
  { n: 'Ăn uống ngày 1–3', cat: 'Ăn uống', p: 0, a: 2150000 },
  { n: 'Thuê xe máy + taxi', cat: 'Đi lại', p: 3, a: 640000 },
  { n: 'Vé phố cổ + hoa đăng', cat: 'Vé tham quan', p: 1, a: 320000 },
];

export const SEED_MEMBERS = [
  { n: 'Minh Trần', e: 'minh.tran@gmail.com', role: 'owner' },
  { n: 'Lan Phạm', e: 'lan.pham@gmail.com', role: 'edit' },
  { n: 'Huy Lê', e: 'huy.le@gmail.com', role: 'edit' },
  { n: 'An Nguyễn', e: 'an.nguyen@gmail.com', role: 'view' },
];

export const TRIP_CARDS = [
  {
    id: 'dnha', seed: 'hoian-lanterns', alt: 'Đèn lồng phố cổ Hội An lúc chập tối',
    dates: '12 – 15/09/2026', title: 'Đà Nẵng – Hội An',
    body: 'Bốn ngày dọc bờ biển miền Trung: Mỹ Khê, Bà Nà, rồi thả đèn trên sông Hoài. Lịch ngày 1–4 đã chốt với cả nhóm.',
    tag: 'Sắp tới', tagCls: 'tag-accent', spend: '14.910.000 ₫ / 16.000.000 ₫',
    stops: 15, people: 4,
  },
  {
    id: 'dalat', seed: 'dalat-pines', alt: 'Đồi thông Đà Lạt trong sương sớm',
    dates: '07 – 09/11/2026', title: 'Đà Lạt cuối tuần',
    body: 'Mới có ngày đi và hai người xác nhận. Chưa thêm điểm dừng nào.',
    tag: 'Nháp', tagCls: 'tag-neutral', spend: 'Chưa lập ngân sách',
    stops: 0, people: 2,
  },
  {
    id: 'bkk', seed: 'bangkok-street', alt: 'Hàng quán ven đường Bangkok về đêm',
    dates: '14 – 18/03/2026', title: 'Bangkok ăn sập',
    body: 'Chuyến đã đi hồi tháng 3. Mọi khoản chi đã tất toán xong.',
    tag: 'Đã đi', tagCls: 'tag-neutral', spend: 'Tất toán 28.400.000 ₫',
    stops: 22, people: 5,
  },
];

export const CATEGORIES = ['Đi lại', 'Lưu trú', 'Ăn uống', 'Vé tham quan', 'Khác'];

export const fmt = (n) => Math.round(n).toLocaleString('vi-VN') + ' ₫';
export const first = (name) => name.split(' ')[0];
