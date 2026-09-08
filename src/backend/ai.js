import { SEED_TRIPS, newDay, newStop, uid } from '../data.js';
import { AI_MODEL, aiBackend, aiLocation, firebaseEnabled } from './config.js';
import { ai } from './firebase.js';
import { cleanGuide, cleanStop, cleanTranslation } from './schema.js';

export const aiAvailable = firebaseEnabled;

/* The model is told the exact shape to return, so the answer needs parsing but
   not coaxing. Everything it sends back is still treated as untrusted input:
   it goes through the same sanitiser as a Firestore document before it is
   allowed anywhere near the trip model. */
/* One stop, written once. The itinerary asks for a whole trip of these and the
   in-trip assistant asks for a single day of them, and the two must not drift:
   both answers land in the same `cleanStop` and the same day document. */
const stopSchema = (Schema) => Schema.object({
  properties: {
    time: Schema.string({ description: 'Giờ bắt đầu, định dạng HH:MM 24 giờ' }),
    name: Schema.string({ description: 'Tên địa điểm có thật' }),
    note: Schema.string({ description: 'Một mẹo thực tế ngắn, tiếng Việt' }),
    cost: Schema.number({ description: 'Chi phí ước tính cho CẢ NHÓM, đơn vị VND' }),
    lat: Schema.number({ description: 'Vĩ độ thật của địa điểm' }),
    lng: Schema.number({ description: 'Kinh độ thật của địa điểm' }),
  },
});

const itinerarySchema = (Schema) => Schema.object({
  properties: {
    title: Schema.string({ description: 'Tên ngắn gọn cho chuyến đi, tiếng Việt' }),
    summary: Schema.string({ description: 'Một câu tóm tắt bản nháp, tiếng Việt' }),
    days: Schema.array({
      items: Schema.object({
        properties: {
          place: Schema.string({ description: 'Khu vực chính của ngày, ví dụ "Hội An"' }),
          stops: Schema.array({ items: stopSchema(Schema) }),
        },
      }),
    }),
  },
});

function buildPrompt({ dest, date, endDate, dayCount, party, partySize, pace, styles, budgetPerPerson }) {
  const style = styles.length ? styles.join(', ') : 'không có yêu cầu riêng';
  return [
    `Soạn lịch trình du lịch ${dayCount} ngày tới ${dest}.`,
    endDate
      ? `Đi từ ngày ${date} đến hết ngày ${endDate}, tính cả hai ngày đó.`
      : `Khởi hành ngày ${date || 'chưa xác định'}.`,
    `Đi cùng: ${party} (${partySize} người).`,
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

/* ── talking to Gemini ──────────────────────────────────────────────────────

   Three features ask the model something now, and all three fail in the same
   two ways a project owner actually hits — App Check not enforced, AI Logic
   not enabled — so the asking and the explaining live in one place. Each
   caller brings its own schema, prompt and temperature, and gets back parsed
   JSON it still has to sanitise. */

/** Load the Gemini SDK on demand — it is a large chunk, and most sessions
 *  never touch a screen that needs it. */
async function loadSdk() {
  try {
    return await import('firebase/ai');
  } catch (err) {
    console.error('SmartTrip · nạp SDK Gemini:', err);
    throw new Error(
      'Không nạp được SDK Gemini. Tải lại trang giúp mình; nếu vẫn lỗi thì dừng dev server và chạy lại npm run dev.',
      { cause: err },
    );
  }
}

/**
 * One structured-output request. `schema` is a function of the SDK's Schema
 * builder, because the builder only exists after the dynamic import.
 *
 * Every nested object in a schema has to be written as
 * `Schema.object({ properties: { … } })` — leaving `properties` out at any
 * level comes back as `400 Unknown name`, and the outer object being right is
 * no protection at all.
 */
async function askModel({ schema, prompt, temperature = 0.9, whenUnreadable }) {
  const mod = await loadSdk();
  const { Schema, getGenerativeModel } = mod;

  const model = getGenerativeModel(ai(mod), {
    model: AI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema(Schema),
      temperature,
    },
  });

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error(`SmartTrip · Gemini (${aiBackend}):`, err);
    const text = String(err?.message ?? '');
    const vertex = aiBackend === 'vertex';
    /* The two failures a project owner actually hits, both fixed in the
       Console rather than in the app — say which one it is. */
    if (text.includes('App Check')) {
      throw new Error(
        'Firebase AI Logic đang bị khoá cho tới khi project bật App Check. Xem mục App Check trong CLAUDE.md.',
        { cause: err },
      );
    }
    if (text.includes('403') || text.includes('PERMISSION_DENIED')) {
      throw new Error(
        vertex
          ? 'Project chưa được phép gọi Gemini qua Vertex AI. Firebase Console → AI Logic, chọn Vertex AI và bật API cho project.'
          : 'Project chưa được phép gọi Gemini. Kiểm tra Firebase Console → AI Logic đã bật chưa.',
        { cause: err },
      );
    }
    /* Vertex serves models per region, so a model that exists can still be
       404 in the location this build asked for. That reads as "model sai tên"
       if we do not say which region was tried. */
    if (vertex && (text.includes('404') || text.includes('NOT_FOUND'))) {
      throw new Error(
        `Vertex AI không có model "${AI_MODEL}"${aiLocation ? ` ở vùng ${aiLocation}` : ''}. `
        + 'Đổi VITE_GEMINI_MODEL hoặc VITE_FIREBASE_AI_LOCATION rồi chạy lại.',
        { cause: err },
      );
    }
    throw new Error('Không gọi được trợ lý AI. Kiểm tra mạng rồi thử lại.', { cause: err });
  }

  try {
    return JSON.parse(result.response.text());
  } catch {
    throw new Error(whenUnreadable);
  }
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

  const parsed = await askModel({
    schema: itinerarySchema,
    prompt: buildPrompt(input),
    whenUnreadable: 'Trợ lý trả về dữ liệu không đọc được. Thử soạn lại giúp mình.',
  });

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

/* ── the assistant inside a trip ────────────────────────────────────────────

   The AI desk writes a trip from nothing. This writes one day at a time into a
   trip that already exists, which is a different job: the answer has to fit
   what is already there, so the current day goes into the prompt and comes
   back rewritten rather than replaced by something unrelated.

   Deliberately one day per request. A model handed a whole trip and told to
   "add a coffee stop" will quietly reflow days nobody asked about, and the
   person applying it cannot see what moved. One day is a change somebody can
   read before they accept it. */

const dayPlanSchema = (Schema) => Schema.object({
  properties: {
    place: Schema.string({ description: 'Khu vực chính của ngày, ví dụ "Hội An"' }),
    summary: Schema.string({ description: 'Một câu nói rõ đã đổi những gì so với ngày cũ, tiếng Việt' }),
    stops: Schema.array({ items: stopSchema(Schema) }),
  },
});

const describeStops = (stops) => (stops.length
  ? stops.map((s) => `- ${s.time} · ${s.name}${s.note ? ` (${s.note})` : ''}`
    + `${s.cost ? ` · ${s.cost} VND` : ''}`).join('\n')
  : '(ngày này chưa có điểm dừng nào)');

function revisePrompt({ mode, dest, dayPlace, dayLabel, stops, request, partySize, pace, budgetPerPerson }) {
  const head = mode === 'add'
    ? [
      `Soạn thêm MỘT ngày mới cho chuyến đi tới ${dest}.`,
      `Ngày này sẽ là ${dayLabel}.`,
      '',
      'Những ngày đã có trong chuyến, để không lặp lại điểm dừng:',
      stops,
    ]
    : [
      `Sửa lại MỘT ngày trong lịch trình chuyến đi tới ${dest}.`,
      `Ngày đang sửa: ${dayPlace || dayLabel}.`,
      '',
      'Các điểm dừng hiện tại của ngày đó:',
      stops,
    ];

  return [
    ...head,
    '',
    `Yêu cầu của người dùng: "${request}"`,
    '',
    `Nhóm ${partySize} người, nhịp độ ${pace}.`,
    budgetPerPerson > 0
      ? `Ngân sách khoảng ${budgetPerPerson.toLocaleString('vi-VN')} ₫ mỗi người cho cả chuyến.`
      : 'Không có ràng buộc ngân sách cụ thể.',
    '',
    'Yêu cầu về câu trả lời:',
    '- Trả về TOÀN BỘ danh sách điểm dừng của ngày đó sau khi sửa, không phải chỉ phần thêm.',
    mode === 'add'
      ? '- 3 đến 5 điểm dừng cho ngày mới.'
      : '- Giữ nguyên những điểm dừng người dùng không đụng tới, kể cả giờ và ghi chú của chúng.',
    '- Chỉ dùng địa điểm có thật, kèm toạ độ lat/lng thật của địa điểm đó.',
    '- Giờ trong ngày phải tăng dần và hợp lý với giờ mở cửa, bữa ăn đúng buổi.',
    '- cost là chi phí cho cả nhóm bằng VND, dùng 0 nếu miễn phí.',
    '- summary nói rõ bạn vừa đổi gì, để người dùng đọc là biết có nên áp dụng không.',
    '- Toàn bộ chữ viết bằng tiếng Việt.',
  ].join('\n');
}

/** Demo-mode answer: honest about being a sample, still the right shape. */
function mockDayPlan({ mode, dayPlace, stops }) {
  const kept = stops.slice(0, 3).map((s) => newStop({ ...s, id: uid('stop') }));
  const extra = newStop({
    time: '16:30',
    name: 'Điểm dừng do trợ lý đề xuất',
    note: 'Chế độ thử chưa gọi Gemini — đây là bản dựng sẵn để xem bố cục.',
    cost: 0,
  });
  return {
    place: mode === 'add' ? 'Ngày mới (bản mẫu)' : (dayPlace || 'Ngày đã sửa'),
    summary: 'Bản mẫu ở chế độ thử — chưa nối Firebase AI Logic nên chưa hỏi được mô hình.',
    items: [...kept, extra],
  };
}

/**
 * Rewrite one day, or write a new one, from a request in the person's own
 * words. Returns `{ place, summary, items }` already sanitised — the caller
 * shows it for approval and only then writes it to the trip.
 *
 * `mode` is 'edit' (rewrite `stops`) or 'add' (a new day; `stops` is then the
 * rest of the trip, passed in so the model does not repeat itself).
 */
export async function reviseDayPlan({
  mode = 'edit', dest, dayPlace, dayLabel, stops = [], request,
  partySize = 1, pace = 'Cân bằng', budgetPerPerson = 0,
}) {
  const asked = String(request ?? '').trim();
  if (!asked) throw new Error('Chưa biết bạn muốn đổi gì. Viết một câu mô tả giúp mình.');

  if (!firebaseEnabled) {
    await new Promise((r) => setTimeout(r, 800));   // keep the skeleton visible
    return mockDayPlan({ mode, dayPlace, stops });
  }

  const parsed = await askModel({
    schema: dayPlanSchema,
    prompt: revisePrompt({
      mode,
      dest,
      dayPlace,
      dayLabel,
      stops: describeStops(stops),
      request: asked,
      partySize,
      pace,
      budgetPerPerson,
    }),
    temperature: 0.7,               // between the guidebook's facts and a fresh plan
    whenUnreadable: 'Trợ lý trả về dữ liệu không đọc được. Thử viết lại yêu cầu giúp mình.',
  });

  const items = (Array.isArray(parsed?.stops) ? parsed.stops : [])
    .map((s) => cleanStop({ ...s, id: uid('stop') }))
    .filter(Boolean)
    .map((s) => newStop(s));

  if (!items.length) throw new Error('Trợ lý chưa đề xuất được điểm dừng nào. Thử viết yêu cầu cụ thể hơn.');

  return {
    place: typeof parsed?.place === 'string' && parsed.place.trim() ? parsed.place.trim() : (dayPlace || ''),
    summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
    items,
  };
}

/* ── local guidebook ────────────────────────────────────────────────────────

   One destination in, one guidebook out: how money and transport work, what is
   rude, what to eat, and the phrases worth having ready. It is generated once
   per destination and then read from the trip, so this is the expensive call
   of the two and the one that must not be made twice for the same place. */

const guideSchema = (Schema) => Schema.object({
  properties: {
    lang: Schema.string({ description: 'Tên tiếng Việt của ngôn ngữ bản địa, ví dụ "Tiếng Thái"' }),
    currency: Schema.string({ description: 'Đồng tiền bản địa và tỷ giá thô so với VND' }),
    summary: Schema.string({ description: 'Hai câu tóm tắt điều cần nhớ nhất, tiếng Việt' }),
    sections: Schema.array({
      items: Schema.object({
        properties: {
          title: Schema.string({ description: 'Tên mục, tiếng Việt, ví dụ "Đi lại"' }),
          tips: Schema.array({
            items: Schema.string({ description: 'Một điều cụ thể, làm được ngay, tiếng Việt' }),
          }),
        },
      }),
    }),
    phrases: Schema.array({
      items: Schema.object({
        properties: {
          vi: Schema.string({ description: 'Câu tiếng Việt' }),
          local: Schema.string({ description: 'Câu đó viết bằng chữ bản địa' }),
          roman: Schema.string({ description: 'Cách đọc ghi theo âm tiếng Việt' }),
        },
      }),
    }),
    emergency: Schema.array({
      items: Schema.object({
        properties: {
          label: Schema.string({ description: 'Tên đầu mối, ví dụ "Cảnh sát du lịch"' }),
          value: Schema.string({ description: 'Số điện thoại hoặc địa chỉ' }),
        },
      }),
    }),
  },
});

const guidePrompt = (dest) => [
  `Viết cẩm nang bản địa ngắn cho người Việt lần đầu tới ${dest}.`,
  '',
  'Yêu cầu:',
  '- 5 đến 7 mục: tiền bạc & thanh toán, đi lại, ăn uống, phong tục nên và không nên,',
  '  an toàn, mua sắm & mặc cả. Mỗi mục 3 đến 5 gạch đầu dòng.',
  '- Mỗi gạch đầu dòng phải là một điều cụ thể làm được ngay, kèm con số khi có',
  '  (giá vé, giờ đóng cửa, mức tip). Không viết chung chung kiểu "nên tôn trọng văn hoá".',
  '- 10 đến 14 câu giao tiếp thật sự cần: chào hỏi, cảm ơn, hỏi giá, mặc cả, gọi món,',
  '  ăn chay, không cay, nhà vệ sinh ở đâu, gọi taxi, cấp cứu.',
  '- Phần cách đọc ghi theo âm tiếng Việt, để người Việt đọc lên là người bản địa hiểu.',
  '- 3 đến 5 đầu mối khẩn cấp: cảnh sát, cấp cứu, cảnh sát du lịch, đại sứ quán Việt Nam nếu có.',
  '- Toàn bộ phần giải thích viết bằng tiếng Việt.',
].join('\n');

/** Demo-mode guidebook: honest about being a sample, still shaped like the real thing. */
const mockGuide = (dest) => ({
  dest,
  lang: 'Tiếng bản địa',
  currency: 'Chưa nối AI Logic nên chưa tra được tỷ giá',
  summary: `Cẩm nang mẫu cho ${dest} — chế độ thử chưa gọi Gemini, nên đây là bản dựng sẵn để xem bố cục.`,
  sections: [
    {
      title: 'Tiền bạc & thanh toán',
      tips: [
        'Đổi một ít tiền mặt ngay ở sân bay cho chặng taxi đầu tiên, phần còn lại đổi trong phố cho được giá.',
        'Hỏi trước quán có nhận thẻ không — nhiều hàng ăn ngon chỉ nhận tiền mặt.',
      ],
    },
    {
      title: 'Đi lại',
      tips: [
        'Chụp màn hình địa chỉ bằng chữ bản địa để đưa tài xế xem; đọc tên theo tiếng Việt thường không ai hiểu.',
        'Chốt giá hoặc yêu cầu bật đồng hồ trước khi xe lăn bánh.',
      ],
    },
    {
      title: 'Ăn uống',
      tips: [
        'Quán đông người bản địa vào giờ ăn là chỉ dấu đáng tin hơn mọi bảng xếp hạng.',
        'Nói rõ mức cay và những thứ bạn không ăn được ngay lúc gọi món.',
      ],
    },
  ],
  phrases: [
    { vi: 'Xin chào', local: '—', roman: 'nối Firebase AI Logic để có câu thật' },
    { vi: 'Cảm ơn', local: '—', roman: 'nối Firebase AI Logic để có câu thật' },
    { vi: 'Bao nhiêu tiền?', local: '—', roman: 'nối Firebase AI Logic để có câu thật' },
  ],
  emergency: [
    { label: 'Chế độ thử', value: 'Chưa có số thật — xem README để bật Gemini' },
  ],
  createdAt: Date.now(),
});

/**
 * Write the guidebook for one destination. The answer is sanitised here rather
 * than at the call site, so whatever reaches the store is already the shape
 * Firestore and the rules expect.
 */
export async function generateGuide({ dest }) {
  const place = String(dest ?? '').trim();
  if (!place) throw new Error('Chưa biết soạn cẩm nang cho nơi nào. Nhập tên điểm đến giúp mình.');

  if (!firebaseEnabled) {
    await new Promise((r) => setTimeout(r, 700));   // keep the skeleton visible
    return cleanGuide(mockGuide(place));
  }

  const parsed = await askModel({
    schema: guideSchema,
    prompt: guidePrompt(place),
    temperature: 0.6,               // facts, not flavour
    whenUnreadable: 'Cẩm nang trả về không đọc được. Thử soạn lại giúp mình.',
  });

  const guide = cleanGuide({ ...parsed, dest: place, createdAt: Date.now() });
  if (!guide) {
    throw new Error('Chưa soạn được cẩm nang cho nơi này. Thử ghi tên đầy đủ hơn, ví dụ "Chiang Mai, Thái Lan".');
  }
  return guide;
}

/* ── translating one line ───────────────────────────────────────────────────

   Cheap, frequent, and used while somebody is standing there waiting for an
   answer, so it asks for less: the sentence, how to say it, what it literally
   means back in Vietnamese, and one line of context. The literal reading is
   there so the person can tell when the model has drifted — you cannot check a
   translation you cannot read. */

const translateSchema = (Schema) => Schema.object({
  properties: {
    text: Schema.string({ description: 'Bản dịch, viết bằng chữ của ngôn ngữ đích' }),
    roman: Schema.string({ description: 'Cách đọc bản dịch, ghi theo âm tiếng Việt' }),
    literal: Schema.string({ description: 'Nghĩa đen của bản dịch, dịch ngược lại tiếng Việt' }),
    note: Schema.string({ description: 'Một câu lưu ý về mức lịch sự hoặc cách dùng, tiếng Việt' }),
  },
});

const translatePrompt = (text, targetName) => [
  `Dịch câu sau sang ${targetName}, để một khách du lịch nói với người bản địa.`,
  '',
  `Câu cần dịch: "${text}"`,
  '',
  'Yêu cầu:',
  '- Dịch tự nhiên như người bản địa nói, không dịch từng chữ.',
  '- Giữ mức lịch sự trung tính, hợp khi nói với người lạ.',
  '- Phần cách đọc ghi theo âm tiếng Việt.',
  '- Phần nghĩa đen dịch ngược bản dịch về tiếng Việt, để người dùng tự kiểm tra được.',
  '- Lưu ý viết bằng tiếng Việt, một câu, và chỉ khi thật sự có gì đáng nói.',
].join('\n');

/**
 * Translate one line for the phrasebook. `target` is a language code from
 * phrasebook.js; `targetName` is what to call that language in the prompt.
 */
export async function translateText({ text, target, targetName }) {
  const source = String(text ?? '').trim();
  if (!source) throw new Error('Chưa có câu nào để dịch.');

  if (!firebaseEnabled) {
    await new Promise((r) => setTimeout(r, 500));
    /* Demo mode has nothing to translate with, and inventing a fake foreign
       sentence would be worse than saying so — someone would read it out. */
    return cleanTranslation({
      source,
      text: source,
      literal: source,
      note: 'Chế độ thử chưa gọi Gemini nên câu này chưa được dịch. Xem README để bật AI Logic.',
      target,
      createdAt: Date.now(),
    });
  }

  const parsed = await askModel({
    schema: translateSchema,
    prompt: translatePrompt(source, targetName),
    temperature: 0.3,               // one right answer, not a creative one
    whenUnreadable: 'Bản dịch trả về không đọc được. Thử lại giúp mình.',
  });

  const out = cleanTranslation({ ...parsed, source, target, createdAt: Date.now() });
  if (!out) throw new Error('Chưa dịch được câu này. Thử viết ngắn lại, hoặc tách thành hai câu.');
  return out;
}
