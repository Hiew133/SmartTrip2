import { useEffect, useId, useRef, useState } from 'react';
import { PLACE_DEBOUNCE_MS, searchPlaces } from '../backend/places.js';
import { isSearchable } from '../places.js';
import { Search } from './ui.jsx';

/* The name field for a stop, with real places behind it.

   Before this, a stop added by hand had no coordinates at all: it never showed
   on the map and the route optimiser skipped it, so both features only ever
   worked on itineraries the AI had written. Picking a suggestion here is what
   fills lat/lng in.

   Two things shape the behaviour more than they look like they should:

   · Nominatim asks for at most one request per second, so the query is
     debounced rather than sent per keystroke, and an in-flight request is
     aborted the moment the text changes again.
   · Searching is opt-in per edit. Opening the editor on an existing stop must
     not fire a lookup for a name that is already settled — only typing does.
     Picking a result puts it back to idle, otherwise the picked name would
     immediately search for itself and reopen the list underneath the person. */
export default function PlaceSearch({ value, onText, onPick, onEnter, placeholder, autoFocus }) {
  const listId = useId();
  const [typing, setTyping] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!typing || !isSearchable(value)) return undefined;
    const ctrl = new AbortController();
    /* Every setState below runs inside the timer or the promise, never in the
       effect body — a synchronous set here would be a cascading render. */
    const t = setTimeout(() => {
      setLoading(true);
      setError('');
      searchPlaces(value, { signal: ctrl.signal })
        .then((found) => { setRows(found); setActive(-1); setLoading(false); })
        .catch((err) => {
          if (err?.name === 'AbortError') return;    // superseded, not failed
          setRows([]); setActive(-1); setLoading(false);
          setError(err?.message || 'Không tìm được địa điểm.');
        });
    }, PLACE_DEBOUNCE_MS);

    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, typing]);

  // close when the click lands anywhere else on the page
  useEffect(() => {
    if (!typing) return undefined;
    const away = (e) => { if (!boxRef.current?.contains(e.target)) setTyping(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [typing]);

  const open = typing && isSearchable(value) && (loading || !!error || rows.length > 0);

  const choose = (row) => {
    setTyping(false);
    setRows([]);
    setActive(-1);
    onPick(row);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (rows.length ? (i <= 0 ? rows.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && rows[active]) choose(rows[active]);
      else onEnter?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTyping(false);
    }
  };

  return (
    <span className="st-placebox" ref={boxRef}>
      <input
        className="input" value={value} placeholder={placeholder} autoFocus={autoFocus}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { setTyping(true); onText(e.target.value); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="st-placelist" id={listId} role="listbox" aria-label="Gợi ý địa điểm">
          {loading && <li className="st-placenote" role="presentation">Đang tìm…</li>}
          {!loading && error && <li className="st-placenote st-placeerr" role="presentation">{error}</li>}
          {!loading && !error && rows.length === 0 && (
            <li className="st-placenote" role="presentation">Không tìm thấy địa điểm nào khớp.</li>
          )}
          {!loading && !error && rows.map((r, i) => (
            <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={`st-placeitem ${i === active ? 'active' : ''}`}
              /* mousedown, not click: the input blurs first and the list would
                 be gone before a click ever landed */
              onMouseDown={(e) => { e.preventDefault(); choose(r); }}
              onMouseEnter={() => setActive(i)}>
              <Search width="14" height="14" aria-hidden="true" />
              <span>
                <b>{r.name}</b>
                {r.address && <span className="st-placeaddr">{r.address}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
