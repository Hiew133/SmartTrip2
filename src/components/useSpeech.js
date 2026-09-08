import { useCallback, useEffect, useRef, useState } from 'react';

/* Speaking and listening, from the browser rather than from a service.
 *
 * The Web Speech API is built in, needs no key and no request of ours leaves
 * the page for it — which matters here, because the alternative was shipping
 * recorded audio of somebody's conversation to a third party to get the same
 * result.
 *
 * It is also unevenly implemented, and that shapes the whole design: speech
 * *synthesis* is everywhere, speech *recognition* is Chrome, Edge and Safari
 * but not Firefox. So the two are separate hooks, each says whether it works
 * at all, and the screen hides the control rather than offering a button that
 * silently does nothing.
 */

const Recognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

export const canListen = !!Recognition;
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Dictation in one language.
 *
 * Returns what has been heard so far while it is still being said, so the box
 * fills in as the person talks instead of staying empty until they stop —
 * without that, a long sentence looks like nothing is happening.
 *
 * `onFinal` fires once with the settled text. Errors come back as a Vietnamese
 * sentence, because the API's own codes ('not-allowed', 'no-speech') would
 * otherwise reach the screen untranslated.
 */
export function useDictation({ tag, onFinal }) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const ref = useRef(null);
  /* Held in a ref so restarting the recogniser does not depend on the caller
     passing the same function identity every render. */
  const finalRef = useRef(onFinal);
  useEffect(() => { finalRef.current = onFinal; }, [onFinal]);

  const stop = useCallback(() => {
    try { ref.current?.stop(); } catch { /* already stopped */ }
  }, []);

  /* Whatever is listening must stop when the screen goes away — a recogniser
     left running holds the microphone indicator on after the user has moved
     on, which reads as the app listening in on them. */
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    if (!Recognition || listening) return;
    setError('');
    setHeard('');

    const rec = new Recognition();
    ref.current = rec;
    rec.lang = tag;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '';
      let settled = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0]?.transcript ?? '';
        if (e.results[i].isFinal) settled += chunk;
        else interim += chunk;
      }
      setHeard(settled || interim);
      if (settled) finalRef.current?.(settled.trim());
    };

    rec.onerror = (e) => {
      setError(
        e?.error === 'not-allowed' || e?.error === 'service-not-allowed'
          ? 'Trình duyệt chưa được phép dùng micro. Bật quyền micro cho trang này rồi thử lại.'
          : e?.error === 'no-speech'
            ? 'Không nghe thấy gì. Bấm micro rồi nói gần hơn một chút.'
            : e?.error === 'network'
              ? 'Nhận dạng giọng nói cần mạng, mà hiện đang không kết nối được.'
              : 'Không nghe được. Thử lại giúp mình.',
      );
    };

    rec.onend = () => { setListening(false); ref.current = null; };

    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Không mở được micro. Thử tải lại trang.');
    }
  }, [tag, listening]);

  return { listening, heard, error, start, stop, supported: canListen };
}

/**
 * Reading a line out loud in one language.
 *
 * `speechSynthesis` keeps one queue for the whole page, so this cancels before
 * it speaks: pressing the button twice should replace the sentence, not queue
 * a second copy behind the first.
 */
export function useSpeaking() {
  const [speaking, setSpeaking] = useState(false);

  /* Leaving the screen mid-sentence should stop the voice, not let it finish
     talking over whatever comes next. */
  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel(); }, []);

  const speak = useCallback((text, tag) => {
    if (!canSpeak || !text) return;
    window.speechSynthesis.cancel();
    const say = new SpeechSynthesisUtterance(text);
    say.lang = tag;
    say.rate = 0.95;                  // a shade slower: this is being read by a stranger
    say.onend = () => setSpeaking(false);
    say.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(say);
  }, []);

  const hush = useCallback(() => {
    if (canSpeak) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, speak, hush, supported: canSpeak };
}
