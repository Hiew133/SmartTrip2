import { useState } from 'react';

/* Text inputs bound straight to trip data would fire one database write per
   keystroke. This keeps typing local and commits once, on blur or Enter.

   The draft also has to survive the round-trip: between committing and the
   backend echoing the new value back, the field must not flicker to the old
   text. It is held against the value it started from, so if someone else
   changes the same field meanwhile, their edit wins instead of being masked
   by a stale local draft. */
export function useFieldDraft(value, commit) {
  const [draft, setDraft] = useState(null);   // { text, base }

  const live = draft && (value === draft.base || value === draft.text);
  const shown = live ? draft.text : (value ?? '');

  return {
    value: shown,
    onChange: (e) => {
      const text = e.target.value;
      setDraft((d) => ({ text, base: d?.base ?? value }));
    },
    onBlur: () => {
      if (live && draft.text !== value) commit(draft.text);
      else if (!live) setDraft(null);
    },
    onKeyDown: (e) => { if (e.key === 'Enter') e.currentTarget.blur(); },
  };
}
