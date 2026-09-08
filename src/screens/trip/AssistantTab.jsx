import { useState } from 'react';
import { useApp } from '../../store.jsx';
import { dayLabel, fmt, newDay } from '../../data.js';
import { aiAvailable, reviseDayPlan } from '../../backend/index.js';
import { ArrowRight, Check, Compass, En, Plus, Seg } from '../../components/ui.jsx';

/* The assistant that works inside a trip, rather than the one that writes a
   trip from nothing (screens/AIDesk.jsx).

   The whole design is one rule: it proposes, the person disposes. Nothing here
   writes to the trip until somebody has read the answer and pressed a button.
   A model that edits an itinerary in place is a model that quietly moves the
   restaurant somebody already booked.

   One day per request, for the same reason. Handed a whole trip and told to
   "add a coffee stop", a model reflows days nobody asked about, and there is
   no way to see what moved. A single day is a change that fits on screen. */

const EXAMPLES = {
  edit: [
    'Thêm một quán cà phê buổi chiều gần điểm dừng cuối',
    'Đổi bữa trưa sang món chay',
    'Bỏ bớt một điểm, ngày này đang kín quá',
    'Xếp lại cho đỡ phải đi vòng',
  ],
  add: [
    'Một ngày đi Bà Nà Hills, đi sớm về chiều',
    'Ngày cuối nhẹ nhàng, gần khách sạn, tiện ra sân bay',
    'Một ngày dành cho chợ và mua quà',
  ],
};

/* The wait shows the shape of the answer forming, the way the AI desk does. */
function PlanSkeleton() {
  return (
    <div className="st-aicard" style={{ marginTop: 22 }} aria-live="polite" aria-busy="true">
      <div className="st-aiday">
        <span className="st-skel" style={{ display: 'block', width: '52%', height: 17, marginBottom: 15 }} />
        {Array.from({ length: 4 }, (_, r) => (
          <div key={r} className="st-aistop" style={{ marginBottom: 11 }}>
            <span className="st-skel" style={{ width: 34, height: 11, flex: 'none' }} />
            <span className="st-skel" style={{ width: `${56 + (r % 4) * 11}%`, height: 11 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssistantTab({ trip }) {
  const { patch, notify, actions } = useApp();
  const [mode, setMode] = useState('edit');       // edit | add
  const [dayIdx, setDayIdx] = useState(0);
  const [request, setRequest] = useState('');
  const [phase, setPhase] = useState('form');     // form | loading | result
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);

  /* The day list can shrink under this tab the same way it can under the
     itinerary, so never index blindly. */
  const idx = Math.min(Math.max(dayIdx, 0), Math.max(trip.days.length - 1, 0));
  const day = trip.days[idx] ?? null;
  const canEditDay = mode === 'edit' && !!day;

  const people = Math.max(1, trip.members.length);
  const budgetPerPerson = trip.plan > 0 ? Math.round(trip.plan / people) : 0;

  /* Names already in the day, so the preview can point at what is actually
     new. A diff somebody can read is what makes "Áp dụng" a real decision
     rather than a leap of faith. */
  const before = new Set((day?.items ?? []).map((s) => s.name.trim().toLowerCase()));
  const isNew = (s) => mode === 'add' || !before.has(s.name.trim().toLowerCase());

  const ask = async () => {
    if (!request.trim()) {
      setError('Viết một câu mô tả bạn muốn đổi gì giúp mình.');
      return;
    }
    if (mode === 'edit' && !day) {
      setError('Chuyến đi chưa có ngày nào để sửa. Chuyển sang "Thêm ngày mới" giúp mình.');
      return;
    }

    setPhase('loading');
    setError('');
    setPlan(null);
    try {
      const answer = await reviseDayPlan({
        mode,
        dest: trip.title,
        dayPlace: day?.place ?? '',
        dayLabel: dayLabel(trip.startDate, mode === 'add' ? trip.days.length : idx),
        /* Editing sends the day being changed; adding sends every day already
           planned, so the new one does not repeat what is there. */
        stops: mode === 'add' ? trip.days.flatMap((d) => d.items) : (day?.items ?? []),
        request,
        partySize: people,
        pace: 'Cân bằng',
        budgetPerPerson,
      });
      setPlan(answer);
      setPhase('result');
    } catch (err) {
      console.error('SmartTrip · trợ lý trong chuyến:', err);
      setPhase('form');
      setError(err?.message || 'Trợ lý chưa trả lời được. Thử lại giúp mình.');
    }
  };

  const apply = async () => {
    if (applying) return;
    setApplying(true);
    if (mode === 'add') {
      await actions.addDay(newDay({ place: plan.place, items: plan.items }));
      notify('Đã thêm ngày mới vào lịch trình', 'sage');
      patch({ tripTab: 'itin', day: trip.days.length, focusIdx: -1 });
    } else {
      await actions.updateDay(day.id, { items: plan.items, place: plan.place || day.place });
      notify(`Đã cập nhật ${plan.place || `ngày ${idx + 1}`}`, 'sage');
      patch({ tripTab: 'itin', day: idx, focusIdx: -1 });
    }
    setApplying(false);
    setPlan(null);
    setPhase('form');
    setRequest('');
  };

  const cost = plan ? plan.items.reduce((s, i) => s + i.cost, 0) : 0;

  return (
    <section className="st-page-narrow" style={{ padding: 0, maxWidth: '74ch' }}>
      <p className="st-lede" style={{ margin: '4px 0 0' }}>
        Nói bằng lời của bạn muốn đổi gì trong lịch trình. Trợ lý soạn lại đúng một ngày và
        đưa bạn xem trước — không có gì được ghi vào chuyến đi cho tới khi bạn bấm áp dụng.
      </p>
      {!aiAvailable && (
        <p className="st-hint" style={{ marginTop: 16, display: 'inline-flex' }}>
          Chưa nối Firebase AI Logic — đang trả bản mẫu. Xem README để bật Gemini.
        </p>
      )}

      <div className="field" style={{ marginTop: 22 }}>
        <label>Bạn muốn làm gì?</label>
        <Seg ariaLabel="Việc muốn trợ lý làm" options={[
          { label: 'Sửa một ngày', active: mode === 'edit', onClick: () => { setMode('edit'); setPlan(null); setPhase('form'); } },
          { label: 'Thêm ngày mới', active: mode === 'add', onClick: () => { setMode('add'); setPlan(null); setPhase('form'); } },
        ]} />
      </div>

      {canEditDay && trip.days.length > 0 && (
        <div className="field" style={{ marginTop: 16 }}>
          <label>Ngày nào?</label>
          <Seg ariaLabel="Chọn ngày để sửa" options={trip.days.map((d, i) => ({
            key: d.id,
            label: `Ngày ${i + 1}`,
            active: i === idx,
            onClick: () => { setDayIdx(i); setPlan(null); setPhase('form'); },
          }))} />
          <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, display: 'block' }}>
            {dayLabel(trip.startDate, idx)} · {day.place || `Ngày ${idx + 1}`} · {day.items.length} điểm dừng
          </span>
        </div>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="assist-req">
          {mode === 'add' ? 'Ngày mới nên có gì?' : 'Đổi gì cho ngày này?'}
          <En> · Ask in your own words</En>
        </label>
        <textarea className="input" id="assist-req" rows={3} value={request}
          placeholder={EXAMPLES[mode][0]}
          onChange={(e) => setRequest(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {EXAMPLES[mode].map((ex) => (
            <button key={ex} type="button" className="st-chip" onClick={() => setRequest(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={ask} disabled={phase === 'loading'}>
          <Compass width="15" height="15" />
          {phase === 'loading' ? 'Trợ lý đang soạn…' : 'Nhờ trợ lý'}
        </button>
        <span className="text-muted" style={{ fontSize: 13.5, fontWeight: 600 }}>
          Xem trước rồi mới áp dụng
        </span>
      </div>

      {error && <p className="st-error">{error}</p>}

      {phase === 'loading' && <PlanSkeleton />}

      {phase === 'result' && plan && (
        <div style={{ marginTop: 26 }} className="st-rise">
          <div className="st-metarow" style={{ marginBottom: 16 }}>
            <span className="tag tag-accent">{mode === 'add' ? 'Ngày mới đề xuất' : 'Bản sửa đề xuất'}</span>
            {plan.place && <span className="tag tag-neutral">{plan.place}</span>}
            <span className="tag tag-neutral">{plan.items.length} điểm dừng</span>
            <span className="tag tag-accent-2">dự chi {fmt(cost)}</span>
          </div>

          <div className="st-aicard">
            <div className="st-aiday">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {plan.items.map((it) => (
                  <div key={it.id} className="st-aistop">
                    <span className="st-aistop-t">{it.time}</span>
                    <span className="st-aistop-n">
                      {it.name}
                      {isNew(it) && (
                        <span className="tag tag-accent" style={{ marginLeft: 8, fontSize: 11 }}>mới</span>
                      )}
                      {it.note && (
                        <span className="st-stop-note" style={{ display: 'block' }}>{it.note}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {plan.summary && (
            <p className="text-muted" style={{ fontSize: 13.5, margin: '18px 0 0', maxWidth: '68ch' }}>
              {plan.summary}
            </p>
          )}
          <p className="st-fineprint" style={{ maxWidth: '68ch' }}>
            {mode === 'add'
              ? 'Ngày này sẽ được thêm vào cuối lịch trình.'
              : 'Áp dụng sẽ thay toàn bộ điểm dừng của ngày đang chọn. Nút Hoàn tác trong tab Lịch trình '
                + 'không giữ được thay đổi này, nên đọc kỹ danh sách trên trước khi bấm.'}
            {' '}Giá và toạ độ do mô hình ước tính — kiểm tra lại trước khi đặt chỗ.
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={apply} disabled={applying}>
              {applying ? 'Đang ghi vào chuyến đi…' : (
                <>
                  {mode === 'add' ? <Plus width="15" height="15" /> : <Check width="15" height="15" />}
                  {mode === 'add' ? 'Thêm ngày này' : 'Áp dụng cho ngày này'}
                </>
              )}
            </button>
            <button type="button" className="btn btn-secondary" disabled={applying} onClick={ask}>
              Soạn lại
            </button>
            <button type="button" className="btn btn-ghost" disabled={applying}
              onClick={() => { setPlan(null); setPhase('form'); }}>
              Bỏ bản này
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="st-linkbtn"
              onClick={() => patch({ tripTab: 'itin', day: mode === 'add' ? idx : idx, focusIdx: -1 })}>
              Xem lịch trình hiện tại<ArrowRight width="13" height="13" style={{ marginLeft: 4 }} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
