(() => {
  "use strict";

  const quietMs = 2500;
  const resumeQuietMs = 4000;
  const editable = 'textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';
  const excluded = '[hidden], [inert], [aria-hidden="true"], [role="dialog"], dialog, article, [data-message-author-role], [data-testid^="conversation-turn-"]';
  const composerSurface = 'form[data-chatgpt-composer], [data-composer-surface], [data-testid="composer"]';
  const sendOrDictate = 'button[data-testid="send-button"], button[aria-label="Send prompt" i], button[aria-label="Start dictation" i]';
  const inputErrors = {
    "no-speech": "No speech was heard. Start listening again when you’re ready.",
    "not-allowed": "Microphone or speech recognition access was denied. Check the browser’s permissions, then start again.",
    "service-not-allowed": "The browser’s speech recognition service is unavailable. Use keyboard dictation in ChatGPT.",
    "audio-capture": "The browser could not open the microphone. Check the input device, then start again.",
    "language-not-supported": "Speech recognition does not support the current language. Use keyboard dictation in ChatGPT.",
    "network": "The browser’s speech recognition service could not connect. Try again or use keyboard dictation.",
    "aborted": "The browser stopped listening. Start again when you’re ready."
  };

  globalThis.createBubbleVoiceInput = function createBubbleVoiceInput({ onResult, onError, onActivity, onReady, onFinalizing }) {
    const Recognizer = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    let active = null;

    // A turn can span several engines. Result indexes belong to one engine only.
    function transcript(turn) {
      return [...turn.segments, ...turn.parts].filter(Boolean).join(" ");
    }

    function detach(turn, abort) {
      clearTimeout(turn.startTimer);
      const engine = turn.engine;
      turn.engine = null;
      if (!engine) return;
      engine.onstart = engine.onspeechstart = engine.onspeechend = null;
      engine.onresult = engine.onerror = engine.onend = null;
      if (abort) {
        try { engine.abort(); } catch { /* Already closed. */ }
      }
    }

    function release(turn, abort) {
      active = null;
      clearTimeout(turn.restartTimer);
      clearTimeout(turn.silenceTimer);
      clearTimeout(turn.quietTimer);
      clearTimeout(turn.endTimer);
      detach(turn, abort);
    }

    function fail(turn, code, message) {
      if (active !== turn) return;
      const words = transcript(turn);
      release(turn, true);
      onError(message || inputErrors[code] || "The browser stopped listening. Try again when you’re ready.", code, words);
    }

    function watchSilence(turn) {
      clearTimeout(turn.silenceTimer);
      turn.silenceTimer = setTimeout(() => fail(turn, "no-speech"), 30000);
    }

    function waitForQuiet(turn, wait = quietMs) {
      clearTimeout(turn.quietTimer);
      if (turn.finishing) return;
      turn.quietTimer = setTimeout(() => {
        if (active !== turn || turn.finishing || !turn.ready) return;
        turn.finishing = true;
        onFinalizing?.();
        turn.endTimer = setTimeout(() => fail(turn, "end-timeout", "The browser could not finish dictation."), 6500);
        try { turn.engine.stop(); } catch { fail(turn, "aborted"); }
      }, wait);
    }

    function openEngine(turn) {
      let engine;
      try {
        engine = new Recognizer();
        engine.continuous = true;
        engine.interimResults = true;
        engine.maxAlternatives = 1;
      } catch {
        fail(turn, "unavailable", "The browser could not open speech recognition.");
        return false;
      }
      turn.engine = engine;
      turn.ready = false;
      let sessionHadWords = false;
      const live = () => active === turn && turn.engine === engine;
      const ready = () => {
        if (turn.ready) return;
        turn.ready = true;
        clearTimeout(turn.startTimer);
        if (!turn.segments.length) onReady?.();
        // Chrome can close an engine while the speaker is quiet. Words already heard
        // must still be sent if the fresh engine hears nothing more.
        else if (!turn.finishing) waitForQuiet(turn, resumeQuietMs);
      };
      engine.onstart = () => { if (live()) ready(); };
      engine.onspeechstart = () => {
        if (!live() || turn.finishing) return;
        ready();
        // Sound is not words. If words were already heard and none follow,
        // the turn still ends.
        if (turn.wordCount) waitForQuiet(turn, resumeQuietMs);
        else clearTimeout(turn.quietTimer);
        watchSilence(turn);
        onActivity?.(turn.wordCount);
      };
      engine.onspeechend = () => {
        if (!live() || turn.finishing) return;
        // Sound is not words here either. With no words heard yet the turn stays
        // open, and the silence timer still ends an empty one.
        if (turn.wordCount) waitForQuiet(turn);
      };
      engine.onresult = event => {
        if (!live()) return;
        ready();
        // Interims are revisions. Replace changed slots; an empty terminal event
        // sometimes precedes an error, so keep the last intelligible snapshot.
        const results = event.results;
        const from = event.resultIndex ?? 0;
        const changed = [];
        for (let index = from; index < results.length; index++) {
          changed.push(results[index][0]?.transcript?.trim() || "");
        }
        if (!changed.some(Boolean)) return;
        // Count the revised suffix only. A long turn needn't re-split all
        // previously confirmed words on every new interim.
        const size = part => part ? part.split(/\s+/u).length : 0;
        for (let index = from; index < turn.parts.length; index++) turn.wordCount -= size(turn.parts[index]);
        turn.parts.length = from;
        for (const part of changed) {
          turn.parts.push(part);
          turn.wordCount += size(part);
        }
        sessionHadWords = true;
        onActivity?.(turn.wordCount);
        if (turn.finishing) return;
        watchSilence(turn);
        // Chrome keeps one speech session open across pauses and reports
        // speech-end only when it closes. The end of a turn is a quiet
        // stretch with no new words.
        waitForQuiet(turn);
      };
      engine.onerror = event => { if (live()) fail(turn, event.error || "recognition-error"); };
      engine.onend = () => {
        if (!live()) return;
        if (turn.finishing) {
          const words = transcript(turn);
          release(turn, false);
          if (words) onResult(words);
          else onError(inputErrors["no-speech"], "no-speech");
          return;
        }
        detach(turn, false);
        // Speech-end can be emitted as part of the browser shutting down this
        // engine. Give the next engine time to detect speech on its own.
        clearTimeout(turn.quietTimer);
        const segment = turn.parts.filter(Boolean).join(" ");
        if (segment) turn.segments.push(segment);
        turn.parts = [];
        turn.emptyEnds = sessionHadWords ? 0 : turn.emptyEnds + 1;
        if (turn.emptyEnds >= 3) {
          fail(turn, "aborted");
          return;
        }
        // Start a fresh engine after the old event dispatch. Late callbacks
        // from the old one cannot modify the new engine's result slots.
        turn.restartTimer = setTimeout(() => { if (active === turn) openEngine(turn); }, 0);
      };
      turn.startTimer = setTimeout(() => fail(turn, "start-timeout", "The browser did not start listening. If Chrome asked to use the microphone, choose Allow, then start again."), 15000);
      try {
        engine.start();
        return true;
      } catch (error) {
        fail(turn, error?.name === "NotAllowedError" ? "not-allowed" : "unavailable");
        return false;
      }
    }

    return {
      supported: typeof Recognizer === "function",
      start() {
        if (active) return false;
        if (typeof Recognizer !== "function") {
          onError("This browser does not offer speech recognition. Use keyboard dictation in ChatGPT.", "unsupported");
          return false;
        }
        const turn = { segments: [], parts: [], wordCount: 0, emptyEnds: 0, finishing: false };
        active = turn;
        watchSilence(turn);
        return openEngine(turn);
      },
      stop() {
        if (!active) return "";
        const words = transcript(active);
        release(active, true);
        return words;
      }
    };
  };

  function usableEditor(editor) {
    if (!editor?.isConnected || !editor.matches(editable) || editor.closest(excluded)) return false;
    if (editor.disabled || editor.readOnly || editor.getAttribute("aria-disabled") === "true" || editor.getAttribute("aria-readonly") === "true") return false;
    const view = editor.ownerDocument.defaultView;
    return editor.getClientRects().length > 0 && view.getComputedStyle(editor).visibility === "visible";
  }

  globalThis.getBubbleComposer = function getBubbleComposer(main) {
    if (!main?.isConnected) return null;
    const candidates = [...main.querySelectorAll(editable)].filter(editor => {
      if (!usableEditor(editor)) return false;
      if (editor.id === "prompt-textarea" || editor.matches('[data-composer-markdown][role="textbox"][aria-label="Ask ChatGPT" i]') || editor.closest(composerSurface)) return true;
      const form = editor.closest("form");
      return Boolean(form && form.querySelector(sendOrDictate));
    });
    return candidates.length === 1 ? candidates[0] : null;
  };

  function blank(editor) {
    if (editor.tagName === "TEXTAREA") return editor.value === "";
    // A blank ProseMirror composer usually contains a paragraph and trailing <br>.
    if (editor.textContent !== "" || editor.querySelector('[contenteditable="false"], img, video, audio, input, [data-mention]')) return false;
    return editor.querySelectorAll("p, br").length <= 2 && [...editor.querySelectorAll("*")].every(node => /^(P|BR|DIV)$/.test(node.tagName));
  }

  globalThis.putBubbleTranscript = function putBubbleTranscript(editor, text, append = false) {
    if (typeof text !== "string" || !text.trim() || !usableEditor(editor) || (!append && !blank(editor))) return false;
    const doc = editor.ownerDocument;
    const view = doc.defaultView;
    const read = () => editor.tagName === "TEXTAREA" ? editor.value : editor.textContent;
    const before = read();
    const transcript = (append && before && !/\s$/u.test(before) ? " " : "") + text.trim();
    const unchanged = () => append ? read() === before : blank(editor);
    let focused = doc.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    if (focused && focused !== editor && !editor.contains(focused) && focused.matches('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return false;

    try {
      editor.focus({ preventScroll: true });
      if (!usableEditor(editor) || !editor.contains(doc.activeElement) || !unchanged()) return false;
      if (editor.tagName === "TEXTAREA") {
        const input = { bubbles: true, composed: true, inputType: "insertText", data: transcript };
        if (!editor.dispatchEvent(new view.InputEvent("beforeinput", { ...input, cancelable: true }))) return false;
        if (!usableEditor(editor) || doc.activeElement !== editor || !unchanged()) return false;
        const setter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, "value").set;
        setter.call(editor, before + transcript);
        editor.setSelectionRange(editor.value.length, editor.value.length);
        editor.dispatchEvent(new view.InputEvent("input", input));
        return editor.isConnected && editor.value === before + transcript;
      }
      const selection = doc.getSelection();
      if (!selection) return false;
      const range = doc.createRange();
      range.selectNodeContents(append ? editor : (editor.querySelector("p") || editor));
      range.collapse(!append);
      selection.removeAllRanges();
      selection.addRange(range);
      // The native editing command routes the insertion through the page's editor.
      doc.execCommand("insertText", false, transcript);
      const normalized = value => value.replace(/\s+/gu, " ").trim();
      return editor.isConnected && normalized(editor.textContent) === normalized(before + transcript);
    } catch {
      return false;
    }
  };
})();
