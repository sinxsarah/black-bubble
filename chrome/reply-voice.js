(() => {
  "use strict";
  const labels = {cove: "ChatGPT's own voice", device: "Device voice", elevenLabs: "ElevenLabs", fishAudio: "Fish Audio"};
  const isCloud = source => source === "elevenLabs" || source === "fishAudio";
  const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
  let extension;
  try {
    if (runtime?.getManifest?.().name === "Black Bubble") extension = runtime;
  } catch { /* Messaging is unavailable outside the extension. */ }

  // Never read the outer turn as text. A single turn may contain both speakers.
  function turnText(turn, role) {
    const other = role === "user" ? "assistant" : "user";
    const marker = '[data-message-author-role="' + role + '"]';
    const marked = (turn.matches(marker) ? [turn] : [...turn.querySelectorAll(marker)])
      .filter(node => !node.closest('[hidden],[inert],[aria-hidden="true"]'));
    let body;
    if (marked.length === 1) body = marked[0];
    else if (!marked.length) {
      const head = '[data-conversation-role="' + role + '"]';
      const heads = turn.matches(head) ? [turn] : turn.querySelectorAll(head);
      if (heads.length === 1) {
        const unit = heads[0].closest('[data-content-search-unit-key]');
        const sibling = heads[0].nextElementSibling;
        const scope = unit || sibling;
        if (scope && turn.contains(scope)) {
          const selector = role === "user" ? '[data-user-message-bubble="true"]' : '[data-response-body]';
          const payloads = (scope.matches(selector) ? [scope] : [...scope.querySelectorAll(selector)])
            .filter(node => !node.closest('[hidden],[inert],[aria-hidden="true"]'));
          if (payloads.length > 1) return "";
          body = payloads[0];
        }
        body ??= unit;
        if (!body && !heads[0].matches('h1,h2,h3,h4,h5,h6,.sr-only')) body = heads[0];
        if (!body && sibling?.matches('[data-content-search-unit-key],[data-message-content],.whitespace-pre-wrap,.markdown')) body = sibling;
      }
      if (!body && (turn.dataset.turn === role || (heads.length === 1 && !turn.querySelector('[data-conversation-role="' + other + '"]')))) body = turn;
    }
    if (!body || !turn.contains(body) || body.closest('[hidden],[inert],[aria-hidden="true"]') ||
        body.querySelector('[data-conversation-role="' + other + '"],[data-message-author-role="' + other + '"]')) return "";
    const payload = '[data-message-content],.markdown,.whitespace-pre-wrap';
    // User turns can include a speaker heading and inline tools alongside the actual prompt.
    if (role === "user" && !body.matches(payload)) {
      const fragments = [...body.querySelectorAll(payload)].filter(node => !node.closest('[hidden],[inert],[aria-hidden="true"]') && !node.parentElement.closest(payload));
      if (fragments.length === 1) body = fragments[0];
    }
    const skip = 'button,[role="button"],[role="menu"],[role="toolbar"],:is(h1,h2,h3,h4,h5,h6)[data-conversation-role],.sr-only,script,style,template,input,textarea,select,svg,details:not([open]),[inert],[hidden],[aria-hidden="true"],[data-testid*="reasoning" i]';
    const parts = [];
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) { parts.push(node.nodeValue); return; }
      if (!(node instanceof Element) || node.matches(skip)) return;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return;
      const block = node.tagName === "BR" || !["inline","contents","inline-block"].includes(style.display);
      if (block) parts.push(" ");
      for (const child of node.childNodes) walk(child);
      if (block) parts.push(" ");
    }
    walk(body);
    return parts.join("").replace(/\s+/gu," ").trim();
  }

  function localVoices() {
    try { return (globalThis.speechSynthesis?.getVoices() || []).filter(voice => voice.localService === true); }
    catch { return []; }
  }

  // Prepare a reusable audio element under the Start gesture.
  function prepareAudio() {
    const media = new Audio();
    media.playsInline = true;
    media.src = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";
    try { media.play()?.catch(() => {}); } catch { /* Playback recovery is handled below. */ }
    return media;
  }

  function player({settings, text, media, valid, onStart, onEnd, onError, onTap}) {
    let live = true;
    let watchdog, nextTimer, utterance, blobURL, started = false, position = 0;
    let requestPending = false;
    const cloud = isCloud(settings.source);
    const id = crypto.randomUUID();
    function clearOwned() {
      clearTimeout(watchdog);
      clearTimeout(nextTimer);
      if (utterance) {
        const synth = globalThis.speechSynthesis;
        utterance.onstart = utterance.onend = utterance.onerror = null;
        // Browsers only expose a global cancel. If another utterance is queued,
        // release our short phrase without cancelling someone else's audio.
        if (synth && (!synth.pending || !synth.speaking)) synth.cancel();
        utterance = null;
      }
      if (media && blobURL) {
        media.onplaying = media.onended = media.onerror = null;
        media.pause();
        media.removeAttribute("src");
        media.load();
        URL.revokeObjectURL(blobURL);
        blobURL = null;
      }
    }
    function stop() {
      if (!live) return;
      live = false;
      clearOwned();
      if (requestPending) extension?.sendMessage({type:"blackBubble.cancel",id}).catch(() => {});
    }
    function fail(message) { if (live) { stop(); onError(message); } }
    function done() { if (live) { stop(); onEnd(); } }
    function owned() {
      if (live && !valid()) fail("The chat changed before the reply finished.");
      return live;
    }
    function began() {
      if (!owned()) return;
      started = true;
      onStart();
    }
    function devicePhrase() {
      if (!owned()) return;
      const synth = globalThis.speechSynthesis;
      const voices = localVoices();
      const voice = settings.deviceVoiceURI ? voices.find(v => v.voiceURI === settings.deviceVoiceURI)
        : voices.find(v => v.default) || voices.find(v => v.lang === navigator.language) || voices[0];
      if (!voice || typeof globalThis.SpeechSynthesisUtterance !== "function") { fail("This device voice is unavailable. Choose an installed voice in Black Bubble."); return; }
      if (synth.paused || synth.pending || synth.speaking) { fail("Another device voice is playing. Wait for it to finish and try again."); return; }
      const phrase = globalThis.nextBubbleDevicePhrase(text, position);
      const item = utterance = new globalThis.SpeechSynthesisUtterance(phrase.words);
      item.voice = voice;
      item.lang = voice.lang;
      let phraseStarted = false;
      item.onstart = () => {
        if (item !== utterance || !owned()) return;
        phraseStarted = true;
        began();
        clearTimeout(watchdog);
        watchdog = setTimeout(() => fail("The device voice stopped responding. Your microphone is off."), 30000);
      };
      item.onend = () => {
        if (item !== utterance || !owned()) return;
        clearTimeout(watchdog);
        utterance = null;
        if (!phraseStarted) { fail("Device playback could not be confirmed. Your microphone is off."); return; }
        position = phrase.end;
        if (position >= text.length) done();
        else nextTimer = setTimeout(devicePhrase, 0);
      };
      item.onerror = event => {
        if (item !== utterance || !owned()) return;
        clearTimeout(watchdog);
        utterance = null;
        if (event.error === "not-allowed" && !phraseStarted) onTap(devicePhrase);
        else fail("Device playback failed. Choose another installed voice and try again.");
      };
      watchdog = setTimeout(() => {
        if (!owned()) return;
        if (synth.speaking || synth.pending) {
          fail("The device voice did not start. Check the device’s speech settings and try again.");
          return;
        }
        utterance = null;
        item.onstart = item.onend = item.onerror = null;
        onTap(devicePhrase);
      }, 2500);
      try { synth.speak(item); } catch { fail("This device could not start its selected voice."); }
    }
    function playAudio() {
      if (!owned()) return;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => fail("The audio player did not start. Your microphone is off."), 6000);
      media.play().catch(error => {
        if (!owned()) return;
        clearTimeout(watchdog);
        if (error.name === "NotAllowedError" && !started) onTap(playAudio);
        else fail("The reply audio could not play on this device.");
      });
    }
    async function receiveAudio() {
      if (!extension || !media) { fail("Open Black Bubble voice settings to connect a provider."); return; }
      requestPending = true;
      watchdog = setTimeout(() => fail("The voice provider took too long. Your microphone is off."), 30000);
      try {
        const response = await extension.sendMessage({type:"blackBubble.synthesize",id,source:settings.source,text});
        requestPending = false;
        if (!owned()) return;
        clearTimeout(watchdog);
        if (response?.error) { fail(response.error); return; }
        if (!response?.audioBase64 || response.mimeType !== "audio/mpeg") { fail("The provider returned no playable audio."); return; }
        const bytes = Uint8Array.from(atob(response.audioBase64), ch => ch.charCodeAt(0));
        blobURL = URL.createObjectURL(new Blob([bytes], {type:response.mimeType}));
        media.onplaying = () => { if (owned()) { clearTimeout(watchdog); began(); } };
        media.onended = () => {
          if (!owned()) return;
          if (started) done();
          else fail("The reply ended before playback could be confirmed.");
        };
        media.onerror = () => fail("This device could not decode the provider’s audio.");
        media.src = blobURL;
        playAudio();
      } catch { if (live) fail("Black Bubble could not get the provider’s audio. Check voice settings and try again."); }
    }
    return { start: cloud ? receiveAudio : devicePhrase, stop };
  }
  globalThis.bubbleReplyVoice = {labels, isCloud, extension, turnText, replyText: turn => turnText(turn,"assistant"), localVoices, prepareAudio, player};
})();
