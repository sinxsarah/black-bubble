(() => {
  "use strict";
  if (document.querySelector("#black-bubble-helper")) return;

  const host = document.createElement("div");
  host.id = "black-bubble-helper";
  const root = host.attachShadow({ mode: "open" });
  const css = `
    :host { all: initial; display: block; position: fixed; right: max(14px, env(safe-area-inset-right)); bottom: max(108px, 14vh); z-index: 2147483500; color-scheme: light; }
    :host([hidden]), [hidden] { display: none !important; }
    * { box-sizing: border-box; }
    .frame { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; font: 15px/1.42 "Inter", system-ui, sans-serif; color: #20201e; }
    button, textarea, select, input { font: inherit; }
    button, summary { cursor: pointer; }
    button { border: 1px solid #c7c6c0; border-radius: 11px; padding: 9px 12px; background: #fff; color: #20201e; }
    button:hover { background: #f0efea; }
    button:disabled { opacity: .6; cursor: default; }
    :focus-visible { outline: 3px solid #4e69ae; outline-offset: 2px; }
    #bubble { width: 54px; height: 54px; padding: 0; display: grid; place-items: center; border-radius: 50%; border: 2px solid #fff; color: white; background: #181818; box-shadow: 0 2px 10px #0004; }
    .wave { display: flex; gap: 3px; align-items: center; height: 24px; }
    .wave i { display: block; width: 3px; height: 7px; background: #fff; border-radius: 3px; }
    .wave i:nth-child(2) { height: 15px; } .wave i:nth-child(3) { height: 23px; } .wave i:nth-child(4) { height: 12px; }
    #panel { width: min(322px, calc(100vw - 28px)); max-height: max(140px, calc(84dvh - 75px)); overflow: auto; overscroll-behavior: contain; padding: 18px; border-radius: 18px; border: 1px solid #b9b8b0; background: #fbfaf6; box-shadow: 0 8px 32px #10101024; }
    h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.2; font-weight: 650; letter-spacing: -.03em; }
    .row { display: flex; gap: 7px; flex-wrap: wrap; }
    #dictate { background: #222320; color: white; border-color: #222320; }
    #status { font-size: 13px; margin: 11px 0; min-height: 1.4em; color: #454641; }
    #cancel { margin-bottom: 10px; }
    details { border-top: 1px solid #d6d6cf; padding-top: 10px; }
    summary { font-weight: 600; }
    label { display: block; margin: 10px 0 4px; }
    textarea, select { display: block; width: 100%; margin: 4px 0 10px; border: 1px solid #b9b8af; background: #fff; color: inherit; padding: 7px; border-radius: 7px; }
    textarea { min-height: 58px; resize: vertical; }
    details p { font-size: 13px; }
    .launch { display: flex; align-items: center; gap: 6px; border-radius: 36px; padding: 4px; background: #fcfbf8; box-shadow: 0 2px 12px #0003; }
    #quick-start, #start-loop { background: #20211f; border-color: #20211f; color: white; font-weight: 600; }
    #quick-start { display: flex; align-items: center; gap: 8px; min-height: 45px; border-radius: 28px; padding-inline: 15px; }
    #start-loop { width: 100%; margin-bottom: 8px; }
    #bubble { width: 40px; height: 40px; border: none; background: #e8e7e2; box-shadow: none; }
    #bubble .wave i { background: #292a28; }
    .launch-dot { border-radius: 50%; width: 11px; height: 11px; background: white; }
    #call { position: fixed; inset: 0; isolation: isolate; overflow: auto; overscroll-behavior: contain; }
    ${globalThis.blackBubbleCallScreen.css}
  `;
  if (typeof globalThis.CSSStyleSheet?.prototype?.replaceSync === "function" && "adoptedStyleSheets" in root) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  } else {
    const style = document.createElement("style");
    style.textContent = css;
    root.append(style);
  }

  function element(parent, tag, attributes, caption) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, value);
    if (caption) node.textContent = caption;
    parent.append(node);
    return node;
  }

  const frame = element(root, "div", { class: "frame" });
  const panel = element(frame, "section", { id: "panel", hidden: "", "aria-labelledby": "bubble-title" });
  const build = globalThis.bubbleReplyVoice.extension?.getManifest().version || "0.3.16";
  const title = "Black Bubble " + build;
  element(panel, "h2", { id: "bubble-title" }, title);
  const startLoop = element(panel, "button", { type: "button", id: "start-loop" }, "Talk hands-free");
  element(panel,"label",{for:"call-size"},"Call size");
  const sizePicker = element(panel,"select",{id:"call-size"});
  element(sizePicker,"option",{value:"full"},"Full screen");
  element(sizePicker,"option",{value:"small"},"Small · show chat");
  const voice = globalThis.bubbleReplyVoice;
  const voiceSettings = element(panel,"div");
  const modeLabel = element(voiceSettings,"label",{for:"reply-source"},"Hands-free reply voice");
  const mode = element(voiceSettings,"select",{id:"reply-source"});
  for (const source of ["cove","device"]) element(mode,"option",{value:source},voice.labels[source]);
  const localPicker = element(voiceSettings,"select",{"aria-label":"Installed voice",hidden:""});
  const selectedSettings = element(voiceSettings,"p",{role:"status",hidden:""});
  const openSettings = element(voiceSettings,"button",{type:"button",hidden:""},"Change voice");
  const actions = element(panel, "div", { class: "row" });
  const dictate = element(actions, "button", { id: "dictate", type: "button" }, "Dictate & read");
  const read = element(actions, "button", { id: "read", type: "button" }, "Read latest");
  const startFromReply = element(actions, "button", {id:"start-from-reply",type:"button"}, "Play last reply & continue");
  const initial = "Dictate a turn, then use ChatGPT’s Send button.";
  const status = element(panel, "p", { id: "status", role: "status" }, initial);
  const cancel = element(panel, "button", { id: "cancel", type: "button", hidden: "" }, "Cancel next read");
  const deviceBox = element(panel, "div");
  const launch = element(frame, "div", {class:"launch"});
  const quickStart = element(launch, "button", {type:"button",id:"quick-start",title:"Listen and send automatically after you finish speaking"});
  element(quickStart,"span",{class:"launch-dot","aria-hidden":"true"});
  const quickLabel = element(quickStart,"span",{},"Talk hands-free");
  element(quickStart,"small",{},build);
  const bubble = element(launch, "button", {
    type: "button", id: "bubble", title: "Black Bubble controls", "aria-label": "Black Bubble",
    "aria-controls": "panel", "aria-expanded": "false"
  });
  const wave = element(bubble, "span", { class: "wave", "aria-hidden": "true" });
  for (let i = 0; i < 5; i++) element(wave, "i");
  const setStatus = message => { status.textContent = message; };
  const resetDevice = globalThis.createBubbleDeviceVoice(deviceBox, setStatus);
  const overlay = element(root,"section",{id:"call",role:"dialog","aria-modal":"true","aria-labelledby":"call-title",hidden:""});
  const layout = element(overlay,"div",{class:"call-layout"});
  element(layout,"h2",{id:"call-title",class:"call-heading","aria-label":title},build);
  const center = element(layout,"div",{class:"call-center"});
  globalThis.blackBubbleCallScreen.addOrb(center);
  const callStatus = element(center,"p",{id:"orb-status",role:"status"});
  const callDetail = element(center,"p",{id:"call-detail",role:"status","aria-atomic":"true"});
  const callActions = element(layout,"div",{class:"call-actions"});
  const resize = element(callActions,"button",{id:"resize-call",type:"button"});
  const sizeIcon = document.createElementNS("http://www.w3.org/2000/svg","svg");
  sizeIcon.setAttribute("viewBox","0 0 24 24");
  sizeIcon.setAttribute("aria-hidden","true");
  const corners = document.createElementNS(sizeIcon.namespaceURI,"path");
  sizeIcon.append(corners);
  resize.append(sizeIcon);
  const endLoop = element(callActions,"button",{id:"end-loop",type:"button","aria-label":"End conversation"});
  const sizeKey = "blackBubble.callSize";
  function showSize(value) {
    const small = value === "small";
    sizePicker.value = overlay.dataset.size = small ? "small" : "full";
    overlay.setAttribute("role",small ? "region" : "dialog");
    if (small) overlay.removeAttribute("aria-modal");
    else overlay.setAttribute("aria-modal","true");
    resize.title = small ? "Switch to full screen" : "Switch to small call";
    resize.setAttribute("aria-label",resize.title);
    corners.setAttribute("d",small ? "M14 4h6v6 M20 4l-7 7 M10 20H4v-6 M4 20l7-7"
      : "M20 4l-7 7 M13 5v6h6 M4 20l7-7 M5 13h6v6");
  }
  function chooseSize(value) {
    showSize(value);
    try {localStorage.setItem(sizeKey,sizePicker.value);} catch { /* Keep this session's choice. */ }
  }
  let savedSize;
  try {savedSize = localStorage.getItem(sizeKey);} catch { /* Use full screen. */ }
  showSize(savedSize);
  sizePicker.addEventListener("change",()=>chooseSize(sizePicker.value));
  resize.addEventListener("click",()=>chooseSize(sizePicker.value === "full" ? "small" : "full"));
  document.documentElement.append(host);

  // ChatGPT's own voice uses only public page controls. Alternative voices read the identified assistant reply.
  function rendered(node) {
    return node && node.getClientRects().length > 0
      && !node.closest('[hidden], [aria-hidden="true"], [inert]')
      && getComputedStyle(node).visibility !== "hidden";
  }

  function pageMain() {
    const composer = [...document.querySelectorAll('#prompt-textarea,[data-composer-markdown][role="textbox"]')].filter(rendered);
    if (composer.length === 1) return composer[0].closest('main,[role="main"]') || document.body;
    const mains = [...document.querySelectorAll('main,[role="main"]')].filter(rendered);
    return mains.find(main => main.querySelector('[data-rail-chat-transcript],[data-message-author-role],[data-turn-key]')) || mains[0] || null;
  }

  const roleNodes = '[data-conversation-role],[data-message-author-role],[data-turn="user"],[data-turn="assistant"]';
  const nonTranscript = 'nav,aside,dialog,[role="dialog"],[role="navigation"],[contenteditable="true"]';
  function transcriptRoot() {
    const scope = pageMain();
    if (!scope || scope.querySelector(roleNodes)) return scope;
    // Some layouts put the composer and the visible conversation in sibling landmarks.
    const histories = [...document.querySelectorAll('main,[role="main"],[data-rail-chat-transcript]')]
      .filter(node => rendered(node) && !node.closest(nonTranscript) && node.querySelector(roleNodes));
    const inner = histories.filter(node => !histories.some(other => other !== node && node.contains(other)));
    return inner.length === 1 ? inner[0] : scope;
  }
  function visibleTurn(turn) {
    if (rendered(turn)) return true;
    return Boolean(turn && getComputedStyle(turn).display === "contents" &&
      [...turn.querySelectorAll(roleNodes)].some(rendered));
  }
  function transcript() {
    const main = transcriptRoot();
    if (!main) return [];
    const entries = [];
    // On the current web layout a single keyed turn contains both speakers.
    const seen = new Map();
    for (const node of main.querySelectorAll(roleNodes)) {
      if (node.closest(nonTranscript + ',[hidden],[inert]')) continue;
      if (node.closest('[aria-hidden="true"]') && !node.matches('[data-conversation-role]')) continue;
      const role = node.getAttribute("data-message-author-role") || node.getAttribute("data-conversation-role") || node.dataset.turn;
      if (role !== "user" && role !== "assistant") continue;
      const pair = node.closest('[data-talvt-turn-state]');
      const keyed = node.closest('[data-turn-key]') || node.closest('[data-content-search-turn-key]');
      const turn = pair || node.closest('[data-testid^="conversation-turn-"],[data-turn],article') || keyed || node;
      if (!visibleTurn(turn)) continue;
      if (!seen.has(turn)) seen.set(turn,new Set());
      if (seen.get(turn).has(role)) continue;
      seen.get(turn).add(role);
      const key = turn.getAttribute("data-turn-id") || keyed?.getAttribute("data-turn-key") || keyed?.getAttribute("data-content-search-turn-key")
        || node.getAttribute("data-message-id") || turn.querySelector('[data-message-author-role="' + role + '"][data-message-id]')?.dataset.messageId
        || turn.getAttribute("data-testid") || turn.id
        || (call ? turn : null);
      entries.push({role,key,turn});
    }
    return entries;
  }

  function matchingButtons(scope, names, testIds = []) {
    if (!scope) return [];
    const assistant = scope.querySelector('[data-conversation-role="assistant"],[data-message-author-role="assistant"]');
    return [...scope.querySelectorAll('button, [role="button"]')].filter(node => {
      if (!rendered(node) || node.disabled || node.getAttribute("aria-disabled") === "true") return false;
      if (node.closest('[data-turn="user"],[data-message-author-role="user"]') ||
          (assistant && (assistant.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING))) return false;
      if (node.closest('.markdown,.whitespace-pre-wrap,[data-message-content],[data-response-body],[data-user-message-bubble],[role="document"],pre,blockquote,[contenteditable="true"]')) return false;
      const siteAction = testIds.includes(node.getAttribute("data-testid"));
      if (!siteAction && node.closest('[data-message-author-role],[data-content-search-unit-key]') && !node.closest('[role="toolbar"]')) return false;
      const label = (node.getAttribute("aria-label") || node.getAttribute("title") || "").trim().toLowerCase();
      return names.includes(label) || (siteAction && !/^(stop|pause|resume|cancel)\b/.test(label));
    });
  }

  function uniqueButton(scope, names, testIds) {
    const buttons = matchingButtons(scope, names, testIds);
    return buttons.length === 1 ? buttons[0] : null;
  }

  const writingStates = new Set(["streaming","generating","thinking","pending","loading","in-progress"]);
  function isGenerating() {
    const main = pageMain();
    if (!main) return false;
    if ([...main.querySelectorAll('[data-testid="stop-button"],button[aria-label="Stop generating" i],button[aria-label="Stop streaming" i]')].some(rendered)) return true;
    for (const turn of [...(transcriptRoot() || main).querySelectorAll('[data-talvt-turn-state]')].reverse()) {
      if (!visibleTurn(turn)) continue;
      const state = turn.getAttribute("data-talvt-turn-state").trim().toLowerCase();
      if (writingStates.has(state)) return true;
      if (!turn.querySelector(roleNodes)) continue;
      if (["complete","completed","finished","idle","done"].includes(state)) return false;
      return !(playback(turn) || moreActions(turn));
    }
    return false;
  }

  function readButtons(turn) {
    return matchingButtons(turn, ["read aloud", "read out loud", "read aloud this response"], ["voice-play-turn-action-button"]);
  }

  function playback(turn) {
    const buttons = readButtons(turn);
    return buttons.length === 1 ? buttons[0] : null;
  }

  function composerMic() {
    const main = pageMain();
    const editor = main?.querySelector('#prompt-textarea, [contenteditable="true"][role="textbox"], textarea');
    const area = editor?.closest('form, [data-composer-surface], [data-testid="composer"]') || main;
    return uniqueButton(area, ["dictate", "start dictation", "dictate message", "dictate text"]);
  }

  let path = location.pathname;
  let pending = null;
  let timer = 0;
  let menuTimer = 0;
  let replyObserver = null;
  let replyFrame = 0;
  let call = null;
  function chatRoute(pathname) {
    const clean = pathname.replace(/\/+$/, "");
    const match = clean.match(/^(.*)\/c\/([^/]+)$/);
    // Some starting pages have a landing suffix that disappears on assignment.
    const base = match ? match[1] : clean;
    return {scope:base.replace(/\/new$/, "").replace(/^(\/.+)\/project$/, "$1"), id:match?.[2] || ""};
  }
  function inChat() {
    if (call?.path === location.pathname) return true;
    return location.pathname === "/" || !!chatRoute(location.pathname).id ||
      !!globalThis.getBubbleComposer(pageMain());
  }

  let choice = null;
  let settingsRequest = 0;
  function showChoice(next) {
    choice = next;
    const source = next?.source;
    const cloud = voice.isCloud(source);
    const title = cloud ? "Talk · Send replies to " + voice.labels[source] : "Talk hands-free";
    quickLabel.textContent = startLoop.textContent = title;
    selectedSettings.textContent = source ? (cloud ? "Each spoken reply goes to " + voice.labels[source] + "." : voice.labels[source]) : "Voice settings unavailable. Reopen the controls to retry.";
    quickStart.disabled = startLoop.disabled = startFromReply.disabled = !next;
    startFromReply.textContent = cloud ? "Send last reply to " + voice.labels[source] + " & continue" : "Play last reply & continue";
    dictate.textContent = source && source !== "cove" ? "Dictate & use ChatGPT's own voice" : "Dictate & read";
    read.textContent = source && source !== "cove" ? "Read latest with ChatGPT" : "Read latest";
  }
  async function refreshChoice() {
    if (!voice.extension) return;
    const token = ++settingsRequest;
    try {
      const data = await voice.extension.sendMessage({type:"blackBubble.getSettings"});
      if (token === settingsRequest) showChoice(data && Object.hasOwn(voice.labels, data.source) ? {source:data.source,deviceVoiceURI:data.deviceVoiceURI || ""} : null);
    } catch { if (token === settingsRequest) showChoice(null); }
  }
  function refreshLocalPicker() {
    const selected = choice?.deviceVoiceURI || "";
    localPicker.replaceChildren();
    element(localPicker,"option",{value:""},"Default installed voice");
    for (const installed of voice.localVoices()) element(localPicker,"option",{value:installed.voiceURI},installed.name + " (" + installed.lang + ")");
    if (selected && ![...localPicker.options].some(option => option.value === selected)) {
      element(localPicker,"option",{value:selected},"Previously selected voice (unavailable)");
    }
    localPicker.value = selected;
    localPicker.hidden = mode.value !== "device";
  }
  if (voice.extension) {
    mode.hidden = modeLabel.hidden = true;
    selectedSettings.hidden = openSettings.hidden = false;
    showChoice(null);
    refreshChoice();
    window.addEventListener("focus", refreshChoice);
    openSettings.addEventListener("click", async event => {
      if (!event.isTrusted) return;
      try { const result = await voice.extension.sendMessage({type:"blackBubble.openSettings"}); if (result?.error) throw new Error(); }
      catch { setStatus("Open Black Bubble’s extension settings to change the voice."); }
    });
  } else {
    let saved;
    try { saved = JSON.parse(localStorage.getItem("blackBubble.localVoice") || "null"); } catch {}
    mode.value = saved?.source === "device" ? "device" : "cove";
    showChoice({source:mode.value,deviceVoiceURI:typeof saved?.deviceVoiceURI === "string" ? saved.deviceVoiceURI : ""});
    function setLocal() {
      showChoice({source:mode.value,deviceVoiceURI:localPicker.value});
      try { localStorage.setItem("blackBubble.localVoice", JSON.stringify(choice)); } catch {}
      refreshLocalPicker();
    }
    mode.addEventListener("change",setLocal);
    localPicker.addEventListener("change",setLocal);
    globalThis.speechSynthesis?.addEventListener?.("voiceschanged",refreshLocalPicker);
    refreshLocalPicker();
  }

  function disarm(message) {
    pending = null;
    replyObserver?.disconnect();
    replyObserver = null;
    cancelAnimationFrame(replyFrame);
    replyFrame = 0;
    clearInterval(timer);
    clearInterval(menuTimer);
    timer = 0;
    menuTimer = 0;
    dictate.disabled = false;
    cancel.hidden = true;
    if (message) setStatus(message);
  }

  function closePanel() {
    disarm();
    resetDevice();
    panel.hidden = true;
    bubble.setAttribute("aria-expanded", "false");
    setStatus(initial);
  }

  function callPhase(owner, phase, title, detail) {
    owner.phase = phase;
    overlay.dataset.phase = phase;
    callStatus.textContent = title;
    callDetail.textContent = detail;
  }

  // If this chat is rebuilding its editor, keep its interrupted turn in this
  // document's memory until its own message box is available again.
  let recovery = null;
  const savedMessage = "Your words are in ChatGPT’s message box. You can edit them or press Send.";
  const retryMessage = "Your words are waiting in this tab. Go back to the original chat and tap Talk hands-free to put them in its message box.";

  function restoreDraft() {
    if (!recovery || location.pathname !== recovery.path || !inChat()) return false;
    const editor = globalThis.getBubbleComposer(pageMain());
    if (!editor || !globalThis.putBubbleTranscript(editor, recovery.words, true)) return false;
    recovery = null;
    return true;
  }

  function finishCall(message, partial) {
    const owner = call;
    call = null;
    if (owner) {
      disarm();
      clearTimeout(owner.nextTimer);
      clearTimeout(owner.routeTimer);
      const heard = owner.input?.stop();
      const words = partial || owner.awaitingText || heard;
      if (words) recovery = {path: owner.listeningPath, words};
      owner.playback?.();
      owner.playback?.stopPlayback();
      owner.reader?.stop();
      if (owner.media) { owner.media.pause(); owner.media.removeAttribute("src"); owner.media.load(); }
    }
    if (recovery && restoreDraft()) message = savedMessage;
    else if (recovery && (owner || message)) message = retryMessage;
    if (message) {
      overlay.hidden = false;
      frame.hidden = true;
      overlay.dataset.phase = "paused";
      callStatus.textContent = "Paused";
      callDetail.textContent = message;
      endLoop.setAttribute("aria-label", "Back to chat");
      if (!document.hidden) endLoop.focus({ preventScroll: true });
    } else if (owner || !overlay.hidden) {
      overlay.hidden = true;
      frame.hidden = false;
      host.hidden = !inChat();
      if (inChat() && !document.hidden) quickStart.focus({ preventScroll: true });
    }
  }

  function failNext(message) {
    if (call) finishCall(message);
    else disarm(message);
  }

  function current(owner) {
    if (call === owner && path !== location.pathname) navigationChanged();
    return call === owner && owner.path === location.pathname && inChat() && !document.hidden;
  }

  const formFor = editor => editor?.closest('form, [data-composer-surface], [data-testid="composer"]');
  const editorText = editor => (editor?.value ?? editor?.textContent ?? "");
  const normal = value => value.normalize("NFC").replace(/[\u200B\uFEFF]/gu,"").replace(/[’‘]/gu,"'").replace(/[“”]/gu,'"').replace(/\s+/gu, " ").trim();
  const lastUser = entries => entries.filter(entry => entry.role === "user").at(-1)?.key;

  function hasAttachment(form) {
    return !form || [...form.querySelectorAll('input[type="file"]')].some(input => input.files?.length) ||
      [...form.querySelectorAll('[data-testid*="remove-file" i], [data-testid*="attachment-pill" i], [aria-label^="Remove attachment" i], [aria-label^="Remove file" i], [aria-label^="Remove image" i]')].some(rendered);
  }

  function audioActive() {
    return globalThis.speechSynthesis?.speaking || globalThis.speechSynthesis?.pending ||
      [...document.querySelectorAll("audio, video")].some(media => !media.paused && !media.ended && !media.muted) ||
      [...(pageMain()?.querySelectorAll('button[aria-pressed="true"], button[aria-label], [data-playback-state]') || [])].some(button => {
        const label = (button.getAttribute("aria-label") || "").toLowerCase();
        return (/^read (aloud|out loud)$/.test(label) && button.getAttribute("aria-pressed") === "true") ||
          /^(stop|pause) (reading|read aloud|playback)/.test(label) || ["playing","buffering"].includes(button.dataset.playbackState);
      });
  }

  function sendTranscript(owner, text, rebuildDeadline = Date.now() + 10000) {
    if (!current(owner) || owner.phase !== "listening") return;
    let editor = owner.editor;
    const first = owner.firstSend;
    if (first?.replyText || first?.inTransit) {
      if (!firstReply(owner, transcript()) || !globalThis.getBubbleComposer(pageMain())) {
        if (Date.now() < rebuildDeadline) owner.nextTimer = setTimeout(() => sendTranscript(owner, text, rebuildDeadline), 120);
        else finishCall("The chat is still opening its message box.");
        return;
      }
      editor = globalThis.getBubbleComposer(pageMain()) || editor;
      owner.userKey = lastUser(transcript());
    }
    const form = formFor(editor);
    const unchanged = () => globalThis.getBubbleComposer(pageMain()) === editor &&
      !hasAttachment(form) && lastUser(transcript()) === owner.userKey && !isGenerating();
    if (!unchanged() || !globalThis.putBubbleTranscript(editor, text)) {
      finishCall("The chat or its draft changed. Check the message box before starting again.");
      return;
    }
    owner.awaitingText = "";
    callPhase(owner, "sending", "Thinking", "Adding your words to this chat.");
    const deadline = Date.now() + 2500;
    function trySend() {
      if (!current(owner) || owner.phase !== "sending") return;
      if (!unchanged() || normal(editorText(editor)) !== normal(text)) {
        finishCall("The draft changed before it could be sent. Check the message box.");
        return;
      }
      const send = uniqueButton(form, ["send", "send prompt", "send message"], ["send-button"]);
      if (!send) {
        if (Date.now() < deadline) owner.nextTimer = setTimeout(trySend, 80);
        else finishCall("Your words are in the message box. I couldn’t find an available Send button.");
        return;
      }
      const beforeSend = transcript();
      armNext(beforeSend, text);
      const route = chatRoute(owner.path);
      if (!owner.firstSend && !route.id) {
        const existing = new Set();
        for (const link of document.querySelectorAll('nav a[href],aside a[href],[role="navigation"] a[href]')) {
          if (link.origin === location.origin) existing.add(chatRoute(link.pathname).id);
        }
        owner.firstSend = {scope:route.scope, words:pending.spoken, priorUsers:pending.userKeys, existing};
        pending.first = owner.firstSend;
      } else if (route.id) {
        owner.firstSend = null;
      } else if (owner.firstSend) {
        owner.firstSend.replyText = "";
      }
      callPhase(owner, "thinking", "Thinking", "Waiting for your sent message to appear in the chat.");
      send.click();
      if (current(owner)) endLoop.focus({ preventScroll: true });
    }
    trySend();
  }

  function listen(owner) {
    if (!current(owner)) return;
    const entries = transcript();
    const editor = globalThis.getBubbleComposer(pageMain());
    if (isGenerating()) {
      finishCall("ChatGPT is still writing a reply. Listening has paused.");
      return;
    }
    if (!editor || !formFor(editor)) {
      finishCall("Black Bubble can’t find this chat’s message box yet. Go back to chat and refresh the page.");
      return;
    }
    if (editorText(editor).trim() || hasAttachment(formFor(editor))) {
      finishCall("In ChatGPT’s message box, send or clear your draft and any attachments before starting again.");
      return;
    }
    if (audioActive()) {
      finishCall("Audio is already playing in this tab. The microphone stayed off.");
      return;
    }
    owner.editor = editor;
    owner.listeningPath = location.pathname;
    owner.userKey = lastUser(entries);
    callPhase(owner, "listening", "Listening", "Opening the microphone for your question.");
    owner.input.start();
  }

  function startCall(event, fromReply = false) {
    navigationChanged();
    if (recovery) { finishCall(retryMessage); return; }
    if (!inChat() || document.hidden || call || !choice || (voice.isCloud(choice.source) && !event.isTrusted)) return;
    closePanel();
    frame.hidden = true;
    overlay.hidden = false;
    overlay.dataset.phase = "thinking";
    callStatus.textContent = "Thinking";
    endLoop.setAttribute("aria-label", "End conversation");
    endLoop.focus({ preventScroll: true });
    const owner = { path: location.pathname, choice:{...choice} };
    call = owner;
    if (voice.isCloud(owner.choice.source)) owner.media = voice.prepareAudio();
    if (voice.extension) refreshChoice().then(() => {
      if (current(owner) && (choice?.source !== owner.choice.source || choice?.deviceVoiceURI !== owner.choice.deviceVoiceURI))
        finishCall("Your voice settings changed. Go back to the bubble to start with your selected voice.");
    });
    owner.input = globalThis.createBubbleVoiceInput({
      onResult: text => {
        owner.awaitingText = text;
        if (call === owner && document.hidden) finishCall("This tab was hidden.");
        else sendTranscript(owner, text);
      },
      onReady: () => { if (current(owner)) callDetail.textContent = "Listening for your question. Pause to send."; },
      onFinalizing: () => { if (current(owner)) callDetail.textContent = "Finishing dictation before sending your question."; },
      onActivity: () => {
        if (current(owner) && owner.phase === "listening") {
          overlay.dataset.phase = "voice";
          callDetail.textContent = "Hearing you.";
        }
      },
      onError: (message, code, words) => { if (call === owner) finishCall(message, words); }
    });
    if (!owner.input.supported) {
      finishCall("Speech recognition is unavailable in this browser. Use the dictation control in the chat.");
    } else if (fromReply) {
      const last = transcript().at(-1);
      if (!last?.key || last.role !== "assistant" || isGenerating() || audioActive()) {
        finishCall("Wait for the last reply and any audio to finish, then try again.");
        return;
      }
      owner.replyKey = last.key;
      if (owner.choice.source === "cove") {
        owner.phase = "thinking";
        const buttons = readButtons(last.turn);
        if (buttons.length === 1) requestPlayback(buttons[0],last.turn);
        else if (buttons.length > 1) finishCall("I found several Read aloud buttons for this reply.");
        else if (!openPlaybackMenu(last)) finishCall("ChatGPT Read Aloud is unavailable for this reply.");
      } else playSelectedReply(owner,last);
    } else listen(owner);
  }

  function followAddress(owner, previous, next) {
    const first = owner.firstSend;
    const from = chatRoute(previous);
    const to = chatRoute(next);
    const intent = owner.navigationIntent;
    owner.navigationIntent = null;
    if (from.id === to.id && (to.id || from.scope === to.scope)) return;
    if (intent?.path === next) {
      finishCall(intent.reason);
      return;
    }
    if (!first) {
      finishCall(from.id && to.id ? "The address switched to another conversation." :
        to.id ? "A chat opened before I sent your question." : "The address left this chat.");
      return;
    }
    if (to.id && to.scope !== first.scope && to.id !== first.id) {
      finishCall("The address opened a conversation in another place.");
      return;
    }
    if (to.id && first.existing.has(to.id)) {
      finishCall("The address opened a chat already in your history.");
      return;
    }
    if (to.id && first.id && to.id !== first.id) {
      if (first.finished) {
        finishCall("The address switched to another conversation after the reply.");
        return;
      }
      // Keep the posted question when the router reuses it. Snapshot the
      // destination after this navigation task's DOM changes have landed.
      const handoff = first.handoff = {question:first.lastQuestion || postedQuestion(first,transcript()), previousReply:first.lastReply};
      queueMicrotask(() => {
        if (call !== owner || first.handoff !== handoff || location.pathname !== next) return;
        const entries = transcript();
        const question = postedQuestion(first,entries);
        if (!sameEntry(question,handoff.question)) return;
        handoff.wasBare = entries.at(-1) === question;
        rememberWriting(first,entries,question);
      });
      first.changedTwice = true;
    }
    clearTimeout(owner.routeTimer);
    first.inTransit = !to.id && to.scope !== first.scope;
    if (first.inTransit) {
      owner.routeTimer = setTimeout(() => {
        if (call === owner && first.inTransit) finishCall("The address changed and never returned to your chat.");
      }, 10000);
    }
    if (to.id) {
      first.id = to.id;
      if (pending && pending.first !== first) pending.checkOrigin = first;
    }
    first.addressChanged = true;
  }

  function navigationChanged() {
    if (location.pathname !== path) {
      const previous = path;
      path = location.pathname;
      if (call) {
        call.path = path;
        followAddress(call, previous, path);
      } else closePanel();
    }
    if (!host.isConnected && document.documentElement) document.documentElement.append(host);
    if (call?.reader && !replyFor(call)) finishCall("The chat changed during playback.");
    host.hidden = overlay.hidden && !inChat();
  }

  function postedQuestion(first, entries) {
    const users = entries.filter(entry => entry.role === "user" && entry.key && !first.priorUsers.has(entry.key));
    if (users.length !== 1 || normal(voice.turnText(users[0].turn,"user")) !== first.words) return null;
    return users[0];
  }

  function sameEntry(a,b) {
    return !!a && !!b && a.turn === b.turn && a.key === b.key;
  }

  function rememberWriting(first,entries,question) {
    const reply = entries.at(-1);
    if (entries.at(-2) === question && reply.role === "assistant" &&
        writingStates.has(reply.turn.getAttribute("data-talvt-turn-state")?.trim().toLowerCase())) first.writing = reply;
  }

  function firstQuestion(first, entries) {
    const question = postedQuestion(first,entries);
    if (!question) return null;
    const handoff = first.handoff;
    const reply = entries.at(-1);
    rememberWriting(first,entries,question);
    if (sameEntry(question,handoff?.question)) {
      // A completed answer already painted during reassignment can be stale.
      // Accept a later arrival after a bare question, a witnessed generation,
      // or the very same reply whose playback we already requested.
      const fresh = handoff.wasBare && reply.key !== handoff.previousReply?.key && reply.turn !== handoff.previousReply?.turn;
      if (reply !== question && (entries.at(-2) !== question ||
          !(fresh || sameEntry(reply,first.writing) || sameEntry(reply,first.requestedReply)))) return null;
    }
    first.lastQuestion = question;
    if (entries.at(-2) === question && reply.role === "assistant") first.lastReply = reply;
    return question;
  }

  function firstReply(owner, entries) {
    const first = owner.firstSend;
    if (!first?.replyText || first.inTransit || isGenerating()) return null;
    const question = firstQuestion(first, entries);
    const latest = entries.at(-1);
    if (!question || latest?.role !== "assistant" || entries.at(-2) !== question) return null;
    return latest.key === owner.replyKey || normal(voice.replyText(latest.turn)) === first.replyText ? latest.turn : null;
  }

  function replyFor(owner) {
    if (!current(owner)) return null;
    const entries = transcript();
    if (owner.firstSend?.replyText) return firstReply(owner, entries);
    const latest = entries.at(-1);
    return latest?.role === "assistant" && latest.key === owner.replyKey && !isGenerating() ? latest.turn : null;
  }

  function playSelectedReply(owner,latest) {
    if (!current(owner)) return;
    disarm();
    owner.replyKey = latest.key;
    const text = voice.replyText(latest.turn);
    if (!text) { finishCall("I couldn’t identify the text to read in this reply."); return; }
    callPhase(owner,"playback","Thinking","Your microphone is off.");
    owner.reader = voice.player({
      settings:owner.choice,text,media:owner.media,valid:() => Boolean(replyFor(owner)),
      onStart:() => callPhase(owner,"speaking","Speaking","The microphone is off while the reply plays."),
      onError:message => { if (call === owner) finishCall(message); },
      onTap:() => {
        if (current(owner)) finishCall("The browser blocked automatic playback. Your microphone is off.");
      },
      onEnd:() => {
        if (!current(owner)) return;
        owner.reader = null;
        owner.nextTimer = setTimeout(() => {
          if (replyFor(owner)) listen(owner);
          else if (call === owner) finishCall("The chat changed during playback.");
        }, 180);
      }
    });
    owner.reader.start();
  }

  function watchReply(owner, turn) {
    owner.playback?.();
    owner.playback = globalThis.watchBubblePlayback({
      turn, samePage:() => current(owner),
      isViewGesture:event => {
        const activation = event.type !== "keydown" || ["Enter"," ","Tab"].includes(event.key);
        if (activation && event.composedPath().includes(resize)) return true;
        if (event.key === "Tab" && event.composedPath().includes(endLoop)) return true;
        if (sizePicker.value !== "small" || event.target.closest?.('button,a,input,select,textarea,[role="button"],[contenteditable],audio,video')) return false;
        // A touch pan starts with pointerdown. A real tap still delivers a click.
        return (event.type === "pointerdown" && event.pointerType === "touch") ||
          (event.type === "keydown" && ["ArrowDown","ArrowUp","PageDown","PageUp","Home","End"].includes(event.key));
      },
      recoverTurn:owner.firstSend ? () => replyFor(owner) : undefined,
      onStart: () => {
        if (!current(owner)) return;
        callPhase(owner, "speaking", "Speaking", "The microphone is off while the reply plays.");
      },
      onEnd: () => {
        if (!current(owner)) return;
        owner.playback = null;
        if (!owner.firstSend && !replyFor(owner)) { finishCall("The chat changed during playback."); return; }
        const deadline = Date.now() + 10000;
        function resume() {
          if (!current(owner)) return;
          if (replyFor(owner) && (!owner.firstSend || globalThis.getBubbleComposer(pageMain()))) {
            if (owner.firstSend) owner.firstSend.finished = true;
            listen(owner);
          }
          else if (owner.firstSend && Date.now() < deadline) owner.nextTimer = setTimeout(resume, 120);
          else finishCall(owner.firstSend ? "The reply finished, but I lost its place in the chat." : "The chat changed during playback.");
        }
        owner.nextTimer = setTimeout(resume, 180);
      },
      onError: message => { if (call === owner) finishCall(message); }
    });
  }

  function requestPlayback(button, turn) {
    if (pending?.first) {
      if (path !== location.pathname) navigationChanged();
      if (!pending?.first || pending.first.inTransit || !firstQuestion(pending.first, transcript())) return;
    }
    disarm("Requested Read Aloud for this reply.");
    const owner = call;
    if (owner) {
      if (!current(owner) || owner.phase !== "thinking") return;
      const latest = transcript().at(-1);
      if (latest?.role !== "assistant" || latest.turn !== turn) { finishCall("The reply changed before playback."); return; }
      if (audioActive()) { finishCall("Audio is already playing in this tab. I paused before starting the reply."); return; }
      owner.replyKey = latest.key;
      if (owner.firstSend && !owner.firstSend.finished) {
        owner.firstSend.requestedReply = latest;
        owner.firstSend.replyText = normal(voice.replyText(turn));
      }
      callPhase(owner, "playback", "Thinking", "Requesting Read aloud and waiting for ChatGPT to confirm playback.");
      watchReply(owner, turn);
      if (!current(owner)) return;
    }
    button.click();
  }

  function moreActions(turn) {
    return uniqueButton(turn, ["more actions", "more options", "more", "more response actions"], ["more-turn-action-button"]);
  }

  function menuFor(more) {
    const id = more.getAttribute("aria-controls");
    if (id) return document.getElementById(id);
    const matches = more.id ? [...document.querySelectorAll('[role="menu"][aria-labelledby]')]
      .filter(node => rendered(node) && node.getAttribute("aria-labelledby").split(/\s+/).includes(more.id)) : [];
    return matches.length === 1 ? matches[0] : null;
  }

  function openPlaybackMenu(latest) {
    if (menuTimer) return true;
    const more = moreActions(latest.turn);
    if (!more || more.getAttribute("aria-haspopup") !== "menu") return false;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return false;
    const otherMenu = [...document.querySelectorAll('[role="menu"]')].some(rendered);
    if (otherMenu && more.getAttribute("aria-expanded") !== "true") return false;
    if (!pending?.first) disarm("Opening the latest reply’s menu.");
    if (call) callDetail.textContent = "Looking for Read aloud in this reply’s menu.";
    const menuOwner = call;
    const menuPath = location.pathname;
    if (more.getAttribute("aria-expanded") !== "true") {
      // Some menu triggers open on pointerdown, others on click.
      if (typeof PointerEvent === "function") {
        more.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true,button:0,buttons:1,pointerType:"mouse"}));
        more.dispatchEvent(new PointerEvent("pointerup", {bubbles:true,button:0,pointerType:"mouse"}));
      }
      if (more.getAttribute("aria-expanded") !== "true" && !rendered(menuFor(more))) more.click();
    }
    const deadline = Date.now() + 1500;
    function checkMenu() {
      const current = transcript().at(-1);
      if (menuOwner && call === menuOwner && pending?.first &&
          (pending.first.inTransit || current?.turn !== latest.turn || current.key !== latest.key || !latest.turn.isConnected)) {
        // Reacquire the posted question on the next observation before opening its new menu.
        clearInterval(menuTimer);
        menuTimer = 0;
        return;
      }
      const sameRoute = menuOwner ? call === menuOwner && call.path === location.pathname : menuPath === location.pathname;
      if (Date.now() > deadline || !sameRoute || document.hidden ||
          current?.turn !== latest.turn || current.key !== latest.key || isGenerating()) {
        failNext("ChatGPT’s reply menu did not expose an automatic Read Aloud action.");
        return;
      }
      const menu = menuFor(more);
      if (!menu || menu.getAttribute("role") !== "menu" || !rendered(menu)) return;
      const items = [...menu.querySelectorAll('[role="menuitem"]')].filter(item => {
        if (!rendered(item) || item.disabled || item.getAttribute("aria-disabled") === "true") return false;
        return (item.getAttribute("aria-label") || item.textContent).trim().toLowerCase() === "read aloud";
      });
      if (items.length === 1) requestPlayback(items[0], latest.turn);
    }
    menuTimer = setInterval(checkMenu, 80);
    checkMenu();
    return true;
  }

  function waiting(detail, reason, limit = 10000) {
    if (!call) return;
    pending.expiryReason = reason;
    if (pending.detail !== detail) {
      pending.detail = detail;
      pending.stepSince = Date.now();
      callDetail.textContent = detail;
    }
    if (Date.now() - pending.stepSince >= limit) failNext(reason);
  }

  function checkNext() {
    navigationChanged();
    if (!pending) return;
    if (Date.now() >= pending.until) {
      failNext(pending.expiryReason || "I timed out waiting for the next reply in this chat.");
      return;
    }
    const entries = transcript();
    if (pending.checkOrigin) {
      const origin = pending.checkOrigin;
      const posted = entries.find(entry => entry.role === "user" && !origin.priorUsers.has(entry.key));
      if (!posted || normal(voice.turnText(posted.turn,"user")) !== origin.words) {
        waiting("Looking for your first question.", "The address changed and I lost your first message.");
        return;
      }
      // It may have a new renderer key. It still predates the current send.
      pending.userKeys.add(posted.key);
    }
    if (pending.first) {
      const first = pending.first;
      if (first.inTransit) return;
      if (first.handoff) {
        const question = postedQuestion(first,entries);
        if (question && entries.length - entries.indexOf(question) > 2) {
          failNext("Several replies followed your first question. I couldn’t tell which one was yours.");
          return;
        }
      }
      if (!firstQuestion(first, entries)) {
        const reason = first.changedTwice ? (postedQuestion(first,entries)
          ? "The address changed twice. Your question stayed on screen, but I couldn’t verify a new reply."
          : "The address changed twice and I lost your first message.") :
          first.lastQuestion && !first.lastQuestion.turn.isConnected ? "The chat was rebuilt and I lost your first message." :
          first.lastQuestion ? "I saw your first message, then it stopped matching." :
          first.addressChanged ? "The address changed and I couldn’t find your first message." :
          "I couldn’t find your first message in this chat.";
        waiting("Looking for your posted question.", reason);
        return;
      }
    }
    const newUsers = entries.filter(item => item.role === "user" && item.key && !pending.userKeys.has(item.key));
    if (newUsers.length > 1) {
      failNext("Several new questions appeared. I couldn’t tell which reply was yours.");
      return;
    }
    if (!newUsers.length) {
      waiting("Waiting for your sent message to appear in the chat.", "I couldn’t find your sent message in this chat.");
      return;
    }
    const newestUser = entries.filter(item => item.role === "user").at(-1);
    if (newestUser !== newUsers[0] || (pending.spoken && normal(voice.turnText(newestUser.turn,"user")) !== pending.spoken)) {
      waiting("Checking the posted question against the words I sent.", "I found a posted question but couldn’t match it to the words I sent.");
      return;
    }
    if (isGenerating()) {
      waiting("ChatGPT is still writing the reply.", "ChatGPT didn’t show that the reply had finished.", 180000);
      return;
    }
    const latest = entries.at(-1);
    if (latest.role !== "assistant" || !latest.key || pending.assistantKeys.has(latest.key) || entries.indexOf(latest) <= entries.indexOf(newestUser)) {
      waiting("I found your question. Waiting for its reply to appear.", "Your question appeared, but I couldn’t identify its reply.", 30000);
      return;
    }
    if (call && call.choice.source !== "cove") {
      // Older layouts can insert the first token just before their Stop button.
      // Read a completed turn state or its final actions before sending any text.
      const complete = latest.turn.getAttribute("data-talvt-turn-state") === "complete" ||
        playback(latest.turn) || moreActions(latest.turn) ||
        uniqueButton(latest.turn, ["copy", "copy response", "copy message"], ["copy-turn-action-button"]);
      if (!complete) {
        waiting("Checking whether the reply has finished.", "I couldn’t confirm that the reply had finished.", 8000);
        return;
      }
      playSelectedReply(call,latest);
      return;
    }
    const buttons = readButtons(latest.turn);
    if (buttons.length === 1) {
      requestPlayback(buttons[0], latest.turn);
    } else if (buttons.length > 1) {
      failNext("I found several Read aloud buttons for this reply. Playback stayed off.");
    } else if (!openPlaybackMenu(latest)) {
      if (call) waiting("Looking for Read aloud on the finished reply.", "The reply finished, but I couldn’t find an available Read aloud button.", 8000);
      else setStatus("Waiting for this reply’s Read Aloud control.");
    }
  }

  function armNext(entries, spoken) {
    pending = {
      spoken: spoken && normal(spoken),
      userKeys: new Set(entries.filter(x => x.role === "user").map(x => x.key)),
      assistantKeys: new Set(entries.filter(x => x.role === "assistant").map(x => x.key)),
      until: Date.now() + 180000
    };
    // Site updates are the normal trigger. The slow poll only covers layouts
    // that replace the observed subtree or change visibility through CSS.
    replyObserver = new MutationObserver(() => {
      if (!pending || replyFrame) return;
      replyFrame = requestAnimationFrame(() => {
        replyFrame = 0;
        if (pending) checkNext();
      });
    });
    replyObserver.observe(transcriptRoot() || document.documentElement, {
      childList: true, subtree: true, characterData:true, attributes: true,
      attributeFilter: ["data-talvt-turn-state", "data-turn-key", "data-message-author-role",
        "data-conversation-role", "data-turn", "data-message-id", "aria-label", "aria-disabled", "disabled", "hidden"]
    });
    timer = setInterval(checkNext, 600);
    dictate.disabled = true;
    cancel.hidden = false;
  }

  dictate.addEventListener("click", () => {
    navigationChanged();
    if (!inChat() || pending || call) return;
    const entries = transcript();
    if (!entries.length || entries.some(entry => !entry.key) || isGenerating()) {
      setStatus("Wait for the current chat to finish loading or replying, then try again.");
      return;
    }
    armNext(entries);
    const mic = composerMic();
    setStatus(mic ? "Finish dictating and press Send in ChatGPT. The next reply is set to play once."
      : "Use the composer mic or keyboard dictation, then press Send. The next reply is set to play once.");
    mic?.click();
  });

  read.addEventListener("click", () => {
    navigationChanged();
    if (!inChat()) return;
    disarm();
    const latest = transcript().at(-1);
    if (latest?.role !== "assistant" || isGenerating()) {
      setStatus("Wait for ChatGPT’s reply to finish.");
      return;
    }
    const button = playback(latest.turn);
    if (button) requestPlayback(button, latest.turn);
    else if (!openPlaybackMenu(latest)) setStatus("I couldn’t find an available Read aloud action for this reply.");
  });
  cancel.addEventListener("click", () => disarm("Next read canceled."));
  for (const control of [quickStart, startLoop]) control.addEventListener("click", event => startCall(event));
  startFromReply.addEventListener("click", event => startCall(event,true));
  endLoop.addEventListener("click", () => finishCall());
  bubble.addEventListener("click", () => {
    if (!panel.hidden) { closePanel(); return; }
    if (voice.extension) refreshChoice();
    panel.hidden = false;
    bubble.setAttribute("aria-expanded", "true");
    dictate.focus();
  });
  root.addEventListener("keydown", event => {
    if (!overlay.hidden && sizePicker.value === "full" && event.key === "Tab") {
      event.preventDefault();
      (root.activeElement === endLoop ? resize : endLoop).focus();
      return;
    }
    if (event.key === "Escape") {
      if (!overlay.hidden) {
        finishCall();
        event.stopPropagation();
        return;
      }
      closePanel();
      bubble.focus();
      event.stopPropagation();
    }
  });
  window.addEventListener("popstate", navigationChanged);
  document.addEventListener("click", event => {
    const link = event.target.closest?.("a[href]");
    if (event.isTrusted && call && link && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
        (!link.target || link.target === "_self") && link.origin === location.origin && link.pathname !== path) {
      call.navigationIntent = {path:link.pathname, reason:"A link took you out of this chat."};
    }
  }, true);
  window.navigation?.addEventListener("navigate", event => {
    if (call && event.navigationType === "traverse" && event.userInitiated) {
      const destination = new URL(event.destination.url).pathname;
      if (destination !== path) call.navigationIntent = {path:destination, reason:"The browser moved to another chat in history."};
    }
  });
  window.navigation?.addEventListener("currententrychange", navigationChanged);
  // Some browsers don't expose the Navigation API to content scripts.
  new MutationObserver(navigationChanged).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (call) finishCall("This tab was hidden. The microphone is off."); closePanel(); }
    else if (recovery && recovery.path === location.pathname) finishCall(retryMessage);
  });
  window.addEventListener("pagehide", () => { if (call) finishCall("The chat page was left. The conversation paused."); closePanel(); });
  navigationChanged();
})();
