import { SEED_TRIPS, newDay, newStop, uid } from '../data.js';
import { AI_MODEL, firebaseEnabled } from './config.js';
import { ai } from './firebase.js';
import { cleanStop } from './schema.js';

export const aiAvailable = firebaseEnabled;

/* The model is told the exact shape to return, so the answer needs parsing but
   not coaxing. Everything it sends back is still treated as untrusted input:
   it goes through the same sanitiser as a Firestore document before it is
   allowed anywhere near the trip model. */
const itinerarySchema = (Schema) => Schema.object({
  properties: {
    title: Schema.string({ description: 'Tên ngắn gọn cho chuyến đi, tiếng Việt' }),
    summary: Schema.string({ description: 'Một câu tóm tắt bản nháp, tiếng Việt' }),
    days: Schema.array({
      items: Schema.object({
        place: Schema.string({ description: 'Khu vực chính của ngày, ví dụ "Hội An"' }),
        stops: Schema.array({
          items: Schema.object({
            time: Schema.string({ description: 'Giờ bắt đầu, định dạng HH:MM 24 giờ' }),
            name: Schema.string({ description: 'Tên địa điểm có thật' }),
            note: Schema.string({ description: 'Một mẹo thực tế ngắn, tiếng Việt' }),
            cost: Schema.number({ description: 'Chi phí ước tính cho CẢ NHÓM, đơn vị VND' }),
            lat: Schema.number({ description: 'Vĩ độ thật của địa điểm' }),
            lng: Schema.number({ description: 'Kinh độ thật của địa điểm' }),
          }),
        }),
      }),
    }),
  },
});

function buildPrompt({ dest, date, dayCount, party, partySize, pace, styles, budgetPerPerson }) {
  const style = styles.length ? styles.join(', ') : 'không có yêu cầu riêng';
  return [
    `Soạn lịch trình du lịch ${dayCount} ngày tới ${dest}.`,
    `Khởi hành ngày ${date || 'chưa xác định'}. Đi cùng: ${party} (${partySize} người).`,
    `Nhịp độ: ${pace}. Phong cách quan tâm: ${style}.`,
    budgetPerPerson > 0
      ? `Ngân sách khoảng ${budgetPerPerson.toLocaleString('vi-VN')} ₫ mỗi người, tức khoảng ${(budgetPerPerson * partySize).toLocaleString('vi-VN')} ₫ cho cả nhóm. Tổng chi phí các điểm dừng nên nằm trong mức đó.`
      : 'Không có ràng buộc ngân sách cụ thể.',
    '',
    'Yêu cầu:',
    '- Đúng ' + dayCount + ' ngày, mỗi ngày 3 đến 5 điểm dừng.',
    '- Chỉ dùng địa điểm có thật, kèm toạ độ lat/lng thật của địa điểm đó.',
    '- Giờ trong ngày phải tăng dần và hợp lý với giờ mở cửa, bữa ăn đúng buổi.',
    '- cost là chi phí cho cả nhóm bằng VND, dùng 0 nếu miễn phí.',
    '- Toàn bộ chữ viết bằng tiếng Việt.',
  ].join('\n');
}

/** Mock used in demo mode: the seeded Đà Nẵng itinerary, trimmed to size. */
function mockItinerary(dayCount) {
  const source = SEED_TRIPS[0].days;
  return {
    title: SEED_TRIPS[0].title,
    summary: 'Bản nháp mẫu (chưa nối Firebase AI Logic).',
    days: Array.from({ length: dayCount }, (_, i) => {
      const d = source[i % source.length];
      return { ...d, id: uid('day'), items: d.items.map((s) => ({ ...s, id: uid('stop') })) };
    }),
  };
}

/**
 * Ask Gemini for an itinerary and return it in the app's own trip shape.
 * Falls back to the seeded mock when no Firebase project is attached.
 */
export async function generateItinerary(input) {
  if (!firebaseEnabled) {
    await new Promise((r) => setTimeout(r, 900));   // keep the skeleton visible
    return mockItinerary(input.dayCount);
  }

  /* Loaded on demand: the Gemini SDK is a large chunk and only this one
     screen ever needs it, so it stays out of the initial bundle. */
  const { Schema, getGenerativeModel } = await import('firebase/ai');

  const model = getGenerativeModel(await ai(), {
    model: AI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: itinerarySchema(Schema),
      temperature: 0.9,
    },
  });

  const result = await model.generateContent(buildPrompt(input));

  let parsed;
  try {
    parsed = JSON.parse(result.response.text());
  } catch {
    throw new Error('Trợ lý trả về dữ liệu không đọc được. Thử soạn lại giúp mình.');
  }

  const days = (Array.isArray(parsed?.days) ? parsed.days : [])
    .slice(0, input.dayCount)
    .map((d) => newDay({
      place: typeof d?.place === 'string' ? d.place : '',
      seed: `ai-${Math.random().toString(36).slice(2, 8)}`,
      items: (Array.isArray(d?.stops) ? d.stops : [])
        .map((s) => cleanStop({ ...s, id: uid('stop') }))
        .filter(Boolean)
        .map((s) => newStop(s)),
    }));

  if (!days.length) throw new Error('Trợ lý chưa soạn được ngày nào. Thử đổi điểm đến hoặc soạn lại.');

  return {
    title: typeof parsed?.title === 'string' && parsed.title.trim() ? parsed.title.trim() : input.dest,
    summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
    days,
  };
}
