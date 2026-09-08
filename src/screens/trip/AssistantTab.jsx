import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store.jsx';
import { dayLabel, fmt, newDay, uid } from '../../data.js';
import { aiAvailable, askAssistant } from '../../backend/index.js';
import { Check, En, Plus, Seg } from '../../components/ui.jsx';

/* The assistant that lives inside a trip, as a conversation.

   Two rules shape everything here.

   It proposes, the person disposes. Nothing reaches the trip until somebody
   reads a proposal and presses Áp dụng. A model that edits an itinerary in
   place is a model that quietly moves the restaurant somebody already booked.

   And it talks about one day at a time. Which day is picked with the chips
   above the conversation, not inferred from the sentence — guessing wrong
   there means writing over a day nobody was discussing, and no amount of
   chat-like polish is worth that. Everything else is a conversation: follow-ups
   work ("thêm một quán nữa"), questions get answers instead of a rewritten
   day, and the thread stays on screen so you can see what you asked for. */

const OPENERS = {
  edit: [
    'Thêm một quán cà phê buổi chiều',
    'Đổi bữa trưa sang món chay',
    'Ngày này kín quá, bỏ bớt một điểm',
    'Có gì hay gần điểm dừng cuối không?',
  ],
  add: [
    'Một ngày đi Bà Nà Hills, đi sớm về chiều',
    'Ngày cuối nhẹ nhàng, tiện ra sân bay',
    'Một ngày dành cho chợ và mua quà',
  ],
};

const msg = (role, text, extra = {}) => ({ id: uid('msg'), role, text, ...extra });

/* Three dots while the model writes. The AI desk uses a skeleton because it
   knows the shape of what is coming; a chat turn might be one sentence or a
   whole day, so it gets the honest version instead. */
function Typing() {
  return (
    <div className="st-chat-row assistant">
      <div className="st-chat-bubble assistant" aria-live="polite">
        <span className="st-typing" aria-label="Trợ lý đang soạn câu trả lời">
          <i /><i /><i />
        </span>
      </div>
    </div>
  );
}

function PlanCard({ items, isNew, applied, onApply, onView, busy, mode }) {
  const cost = items.reduce((s, i) => s + i.cost, 0);
  return (
    <div className="st-chat-plan">
      <div className="st-metarow" style={{ marginBottom: 12 }}>
        <span className="tag tag-neutral">{items.length} điểm dừng</span>
        <span className="tag tag-accent-2">dự chi {fmt(cost)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map((it) => (
          <div key={it.id} className="st-aistop">
            <span className="st-aistop-t">{it.time}</span>
            <span className="st-aistop-n">
              {it.name}
              {isNew(it) && <span className="tag tag-accent" style={{ marginLeft: 8, fontSize: 11 }}>mới</span>}
              {it.note && <span className="st-stop-note" style={{ display: 'block' }}>{it.note}</span>}
            </span>
          </div>
        ))}
      </div>
      {applied ? (
        /* Applying does not navigate away: the thread is the point, and losing
           it to change one day would make follow-ups impossible. The way over
           is offered instead of taken. */
        <p className="st-chat-applied">
          <Check width="14" height="14" />Đã ghi vào chuyến đi
          <button type="button" className="st-linkbtn" style={{ marginLeft: 6 }} onClick={onView}>
            Xem trên lịch trình
          </button>
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={onApply} disabled={busy}>
            {busy ? 'Đang ghi…' : (
              <>
                {mode === 'add' ? <Plus width="14" height="14" /> : <Check width="14" height="14" />}
                {mode === 'add' ? 'Thêm ngày này' : 'Áp dụng cho ngày này'}
              </>
            )}
          </button>
          <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
            {mode === 'add' ? 'Thêm vào cuối lịch trình' : 'Thay toàn bộ điểm dừng của ngày đang chọn'}
          </span>
        </div>
      )}
    </div>
  );
}

export default function AssistantTab({ trip }) {
  const { patch, notify, actions } = useApp();
  const [mode, setMode] = useState('edit');       // edit | add
  const [dayIdx, setDayIdx] = useState(0);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const endRef = useRef(null);

  /* The day list can shrink under this tab the same way it can under the
     itinerary, so never index blindly. */
  const idx = Math.min(Math.max(dayIdx, 0), Math.max(trip.days.length - 1, 0));
  const day = trip.days[idx] ?? null;
  const showDayPicker = mode === 'edit' && trip.days.length > 0;

  const people = Math.max(1, trip.members.length);
  const budgetPerPerson = trip.plan > 0 ? Math.round(trip.plan / people) : 0;

  /* Scroll the newest message into view. In an effect because it has to happen
     after the browser has laid the message out, and it touches the DOM rather
     than state, so it is not the cascading-render kind of effect. */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [thread.length, thinking]);

  /* Switching day or mode starts a new conversation. Carrying the thread over
     would leave "thêm một quán nữa" pointing at a day that is no longer the
     one being written to. */
  const retarget = (next) => {
    next();
    setThread([]);
    setDraft('');
  };

  const send = async (text) => {
    const asked = String(text ?? '').trim();
    if (!asked || thinking) return;
    if (mode === 'edit' && !day) {
      setThread((t) => [...t, msg('assistant', 'Chuyến đi chưa có ngày nào để sửa. Chuyển sang "Thêm ngày mới" giúp mình.', { error: true })]);
      return;
    }

    /* The history sent is the thread as it was *before* this message, which is
       exactly what the model needs: the new message is passed separately. */
    const history = thread.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setThread((t) => [...t, msg('user', asked)]);
    setDraft('');
    setThinking(true);

    try {
      const answer = await askAssistant({
        mode,
        dest: trip.title,
        dayPlace: day?.place ?? '',
        dayLabel: dayLabel(trip.startDate, mode === 'add' ? trip.days.length : idx),
        /* Editing sends the day being changed; adding sends every day already
           planned, so the new one does not repeat what is there. */
        stops: mode === 'add' ? trip.days.flatMap((d) => d.items) : (day?.items ?? []),
        request: asked,
        history,
        partySize: people,
        pace: 'Cân bằng',
        budgetPerPerson,
      });
      setThread((t) => [...t, msg('assistant', answer.reply, {
        plan: answer.items.length ? { place: answer.place, items: answer.items } : null,
        /* The day as it stood when this proposal was made, so the "mới" badges
           keep telling the truth after something else has been applied. */
        before: new Set((day?.items ?? []).map((s) => s.name.trim().toLowerCase())),
        mode,
        dayIdx: idx,
      })]);
    } catch (err) {
      console.error('SmartTrip · trợ lý trong chuyến:', err);
      setThread((t) => [...t, msg('assistant', err?.message || 'Trợ lý chưa trả lời được. Thử lại giúp mình.', { error: true })]);
    } finally {
      setThinking(false);
    }
  };

  const apply = async (m) => {
    if (applyingId) return;
    setApplyingId(m.id);
    if (m.mode === 'add') {
      /* Read before the write: the day lands at the end, and `trip` here is
         still the version without it. */
      const landsAt = trip.days.length;
      await actions.addDay(newDay({ place: m.plan.place, items: m.plan.items }));
      notify('Đã thêm ngày mới vào lịch trình', 'sage');
      setThread((t) => t.map((x) => (x.id === m.id ? { ...x, applied: true, viewIdx: landsAt } : x)));
      setApplyingId(null);
      return;
    }

    /* The proposal names the day it was made for. Between then and now the day
       can be gone — somebody else deleting it while this tab sat open — and
       writing to whatever is at that index instead would edit the wrong day. */
    const target = trip.days[m.dayIdx];
    if (!target) {
      setThread((t) => [...t, msg('assistant', 'Ngày đó không còn trong chuyến đi nữa — có thể ai đó vừa xoá nó.', { error: true })]);
      setApplyingId(null);
      return;
    }
    await actions.updateDay(target.id, { items: m.plan.items, place: m.plan.place || target.place });
    notify(`Đã cập nhật ${m.plan.place || `ngày ${m.dayIdx + 1}`}`, 'sage');
    setThread((t) => t.map((x) => (x.id === m.id ? { ...x, applied: true, viewIdx: m.dayIdx } : x)));
    setApplyingId(null);
  };

  const view = (m) => patch({ tripTab: 'itin', day: m.viewIdx ?? 0, focusIdx: -1 });

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter is a new line — the way every chat box works
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  return (
    <section className="st-chat">
      <div className="st-chat-head">
        <Seg ariaLabel="Việc muốn trợ lý làm" options={[
          { label: 'Sửa một ngày', active: mode === 'edit', onClick: () => retarget(() => setMode('edit')) },
          { label: 'Thêm ngày mới', active: mode === 'add', onClick: () => retarget(() => setMode('add')) },
        ]} />
        {showDayPicker && (
          <Seg ariaLabel="Chọn ngày để nói tới" options={trip.days.map((d, i) => ({
            key: d.id,
            label: `Ngày ${i + 1}`,
            active: i === idx,
            onClick: () => retarget(() => setDayIdx(i)),
          }))} />
        )}
        <span className="st-chat-context">
          {mode === 'add'
            ? `Ngày mới sẽ là ngày ${trip.days.length + 1} của chuyến`
            : day && `${dayLabel(trip.startDate, idx)} · ${day.place || `Ngày ${idx + 1}`} · ${day.items.length} điểm dừng`}
        </span>
      </div>

      <div className="st-chat-log">
        {thread.length === 0 && (
          <div className="st-chat-empty">
            <p>
              Nhắn cho trợ lý như nhắn cho một người bạn rành đường.
              Nó chỉ động vào <b>{mode === 'add' ? 'một ngày mới' : `ngày ${idx + 1}`}</b>, và
              không ghi gì vào chuyến đi cho tới khi bạn bấm áp dụng.
              <En> · It proposes, you decide.</En>
            </p>
            {!aiAvailable && (
              <p className="st-hint" style={{ display: 'inline-flex' }}>
                Chưa nối Firebase AI Logic — đang trả bản mẫu. Xem README để bật Gemini.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {OPENERS[mode].map((o) => (
                <button key={o} type="button" className="st-chip" onClick={() => send(o)}>{o}</button>
              ))}
            </div>
          </div>
        )}

        {thread.map((m) => (
          <div key={m.id} className={`st-chat-row ${m.role}`}>
            <div className={`st-chat-bubble ${m.role}${m.error ? ' error' : ''}`}>
              <p style={{ margin: 0 }}>{m.text}</p>
              {m.plan && (
                <PlanCard
                  items={m.plan.items}
                  mode={m.mode}
                  applied={!!m.applied}
                  busy={applyingId === m.id}
                  isNew={(s) => m.mode === 'add' || !m.before.has(s.name.trim().toLowerCase())}
                  onApply={() => apply(m)}
                  onView={() => view(m)}
                />
              )}
            </div>
          </div>
        ))}

        {thinking && <Typing />}
        <div ref={endRef} />
      </div>

      <div className="st-chat-compose">
        <textarea
          className="input" rows={2} value={draft} disabled={thinking}
          aria-label="Nhắn cho trợ lý"
          placeholder={thinking ? 'Trợ lý đang soạn…' : `${OPENERS[mode][0]}  (Enter để gửi)`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown} />
        <button type="button" className="btn btn-primary" disabled={thinking || !draft.trim()}
          onClick={() => send(draft)}>
          Gửi
        </button>
      </div>
      {thread.length > 0 && (
        <div className="st-chat-foot">
          <button type="button" className="st-linkbtn" onClick={() => setThread([])}>Xoá cuộc trò chuyện</button>
          <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
            Giá và toạ độ do mô hình ước tính — kiểm tra lại trước khi đặt chỗ.
          </span>
        </div>
      )}
    </section>
  );
}
