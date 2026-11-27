(() => {
  "use strict";

  // Queue one short phrase at a time. Browser TTS has no per-utterance cancel.
  function nextPhrase(text, start) {
    let end = Math.min(start + 78, text.length);
    if (end < text.length) {
      const sample = text.slice(start, end);
      const punctuation = [...sample.matchAll(/[.!?…,;。！？；，]["'”’)]*(?:\s+|(?=[^\x00-\x7f]))/gu)].pop();
      const space = sample.search(/\s+\S*$/u);
      if (punctuation) end = start + punctuation.index + punctuation[0].length;
      else if (space > 0) end = start + space;
      else if (/[\uD800-\uDBFF]/u.test(text.charAt(end - 1))) end -= 1;
    }
    return { words: text.slice(start, end).trim(), end };
  }

  globalThis.nextBubbleDevicePhrase = nextPhrase;
  globalThis.createBubbleDeviceVoice = function createBubbleDeviceVoice(container, setStatus) {
    const doc = container.ownerDocument;
    const synth = globalThis.speechSynthesis;
    const Utterance = globalThis.SpeechSynthesisUtterance;
    const supported = Boolean(synth && typeof synth.getVoices === "function" && typeof Utterance === "function");
    const make = (tag, text) => {
      const element = doc.createElement(tag);
      if (text) element.textContent = text;
      return element;
    };

    const panel = make("details");
    panel.dataset.bubbleDevice = "";
    const summary = make("summary", "Read pasted text with a device voice");
    const textLabel = make("label", "Text to read");
    const draft = make("textarea");
    draft.rows = 3;
    draft.spellcheck = false;
    draft.autocomplete = "off";
    draft.setAttribute("autocapitalize", "off");
    draft.dataset.deviceText = "";
    textLabel.append(draft);

    const voiceLabel = make("label", "Device voice");
    const picker = make("select");
    picker.dataset.deviceVoice = "";
    voiceLabel.append(picker);
    const controls = make("div");
    controls.className = "row";
    const read = make("button", "Read");
    const stop = make("button", "Stop");
    read.type = stop.type = "button";
    read.dataset.deviceRead = stop.dataset.deviceStop = "";
    controls.append(read, stop);
    const hint = make("p");
    hint.dataset.deviceHint = "";
    hint.setAttribute("aria-live", "polite");
    panel.append(summary, textLabel, voiceLabel, controls, hint);
    container.append(panel);

    let voices = [];
    let run = null;
    let current = null;
    let watchdog;

    function localVoices() {
      if (!supported) return [];
      try {
        return synth.getVoices().filter(voice => voice.localService === true);
      } catch {
        return [];
      }
    }

    function updateControls() {
      picker.disabled = voices.length === 0 || Boolean(current || run);
      read.disabled = picker.disabled || !draft.value.trim();
      stop.disabled = !run;
    }

    function voiceKey(voice) {
      return JSON.stringify([voice.voiceURI, voice.lang, voice.name]);
    }

    function refreshVoices() {
      const selected = picker.value;
      voices = localVoices();
      picker.replaceChildren();
      for (const voice of voices) {
        const option = make("option", voice.lang ? voice.name + " (" + voice.lang + ")" : voice.name);
        option.value = voiceKey(voice);
        picker.append(option);
      }
      const choice = voices.find(v => voiceKey(v) === selected) || voices.find(v => v.default) || voices[0];
      if (choice) picker.value = voiceKey(choice);
      if (!current) {
        if (!supported) hint.textContent = "This browser does not offer device speech. Use ChatGPT’s Read Aloud.";
        else if (!choice) hint.textContent = "No local voices are available. Install a device voice, then reopen this section.";
        else hint.textContent = "Paste a reply to hear it on this device. Stop finishes the current phrase.";
      }
      updateControls();
    }

    function report(message) {
      hint.textContent = message;
      setStatus(message);
    }

    function stopRun() {
      if (!run) return;
      run.text = "";
      run = null;
      updateControls();
    }

    function finish(utterance, message) {
      if (current !== utterance) return;
      clearTimeout(watchdog);
      current = null;
      const shouldReport = Boolean(run);
      stopRun();
      refreshVoices();
      if (shouldReport && message) report(message);
    }

    function speakNext() {
      if (!run) return;
      const voice = localVoices().find(v => voiceKey(v) === run.key);
      if (!voice || synth.paused || synth.pending || synth.speaking) {
        stopRun();
        refreshVoices();
        report(voice ? "The device reader is busy. Try Read again when it is quiet." : "That local voice is unavailable. Choose another device voice.");
        return;
      }
      const phrase = nextPhrase(run.text, run.position);
      run.position = phrase.end;
      while (run.position < run.text.length && /\s/u.test(run.text.charAt(run.position))) run.position += 1;
      let utterance;
      try {
        utterance = new Utterance(phrase.words);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        current = utterance;
        updateControls();
        utterance.onend = () => {
          if (current !== utterance) return;
          if (!run || run.position === run.text.length) {
            finish(utterance, "Finished reading.");
            return;
          }
          clearTimeout(watchdog);
          current = null;
          const continuing = run;
          // Let the browser release its completed utterance before checking its queue.
          setTimeout(() => {
            if (run === continuing) speakNext();
          }, 0);
        };
        utterance.onerror = () => finish(utterance, "The device could not play that voice. Try another local voice.");
        watchdog = setTimeout(() => finish(utterance, "The device reader did not respond. Check the tab’s sound and try again."), 30000);
        synth.speak(utterance);
      } catch {
        clearTimeout(watchdog);
        current = null;
        stopRun();
        refreshVoices();
        report("Device speech could not start. Try another local voice.");
      }
    }

    read.addEventListener("click", () => {
      const text = draft.value.trim();
      if (current || run || !text || !picker.value) return;
      run = { text, key: picker.value, position: 0 };
      report("Reading with the device voice.");
      speakNext();
    });
    stop.addEventListener("click", () => {
      if (!run) return;
      stopRun();
      report("Stopping after the current phrase.");
    });
    draft.addEventListener("input", updateControls);
    panel.addEventListener("toggle", () => {
      if (panel.open) {
        refreshVoices();
        synth?.addEventListener?.("voiceschanged", refreshVoices);
      } else {
        synth?.removeEventListener?.("voiceschanged", refreshVoices);
      }
    });

    refreshVoices();
    return function reset() {
      stopRun();
      draft.value = "";
      panel.open = false;
      synth?.removeEventListener?.("voiceschanged", refreshVoices);
      refreshVoices();
      if (current) hint.textContent = "Stopping after the current phrase.";
    };
  };
})();
