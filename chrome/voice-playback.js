(() => {
  "use strict";

  globalThis.watchBubblePlayback = function ({ turn, onStart, onEnd, onError, samePage, recoverTurn, isViewGesture }) {
    const doc = turn.ownerDocument;
    const win = doc.defaultView;
    const location = win.location.href;
    const actions = 'button, [role="button"], [role="checkbox"], [role="menuitemcheckbox"]';
    const readAction = /^(?:read (?:aloud|out loud)|(?:stop|pause|resume|cancel) (?:reading(?: (?:aloud|out loud))?|read aloud|playback))$/i;
    const complete = /^(?:ended|finished|completed)$/i;
    const name = node => (node.getAttribute("aria-label") || node.getAttribute("title") || "").trim();
    const isRead = node => readAction.test(name(node)) || node.getAttribute("data-testid") === "voice-play-turn-action-button";
    const turnControls = () => [...turn.querySelectorAll(actions)].filter(node => isRead(node) &&
      !node.closest('[hidden],[aria-hidden="true"],[inert],.markdown,.whitespace-pre-wrap,[data-message-content],[data-response-body],[data-user-message-bubble],[role="document"],pre,blockquote') &&
      (!node.closest('[data-content-search-unit-key],[data-message-author-role]') ||
        node.dataset.testid === "voice-play-turn-action-button" || node.closest('[role="toolbar"]')));
    const stateOf = node => {
      const state = (node.getAttribute("data-playback-state") || "").toLowerCase();
      if (complete.test(state)) return "end";
      if (/^(?:error|failed|cancell?ed|paused|stopped)$/.test(state) || /^resume /i.test(name(node))) return "interrupted";
      if (/^(?:buffering|waiting|loading)$/.test(state)) return "buffering";
      if (state === "playing" || /^(?:stop|pause|cancel) /i.test(name(node))) return "active";
      const pressed = node.getAttribute("aria-pressed") || node.getAttribute("aria-checked");
      return pressed === "true" ? "active" : pressed === "false" || readAction.test(name(node)) ? "idle" : "";
    };
    const flag = node => node?.getAttribute("aria-pressed") ?? node?.getAttribute("aria-checked");
    const initialControls = turnControls();
    const firstButton = initialControls.length === 1 ? initialControls[0] : null;
    let toggle = firstButton && stateOf(firstButton) === "idle" ? firstButton : null;
    const pair = turn.closest("[data-turn-key]");
    const pairKey = pair?.getAttribute("data-turn-key");
    const isPair = pair === turn;
    const turnId = turn.getAttribute("data-turn-id");
    const wrapper = '[data-testid^="conversation-turn-"], [data-turn], article';
    const assistantSelector = '[data-message-author-role="assistant"][data-message-id]';
    const messageId = (turn.matches(assistantSelector) ? turn : turn.querySelector(assistantSelector))
      ?.getAttribute("data-message-id");
    const assistantIdSelector = messageId ? assistantSelector + '[data-message-id="' + win.CSS.escape(messageId) + '"]' : "";
    const assistantHeading = 'h4[data-conversation-role="assistant"]';
    const requireHeading = !!pairKey && !!turn.querySelector(assistantHeading);
    function isOriginalReply(node) {
      return (!pairKey || node.closest("[data-turn-key]")?.getAttribute("data-turn-key") === pairKey) &&
        (!turnId || node.getAttribute("data-turn-id") === turnId) &&
        (!requireHeading || !!node.querySelector(assistantHeading)) &&
        (!messageId || node.matches(assistantIdSelector) || !!node.querySelector(assistantIdSelector));
    }
    function resolveReply() {
      const main = doc.querySelector('main, [role="main"]');
      if (!main) return null;
      const match = (attr, value) => '[' + attr + '="' + win.CSS.escape(value) + '"]';
      let matches;
      if (pairKey) {
        matches = [...main.querySelectorAll(match("data-turn-key", pairKey))].flatMap(node =>
          isPair ? [node] : [...node.querySelectorAll("[data-talvt-turn-state]")]);
      } else if (turnId) {
        matches = [...main.querySelectorAll(match("data-turn-id", turnId))];
      } else if (messageId) {
        matches = [...main.querySelectorAll(assistantIdSelector)]
          .map(node => node.closest(wrapper) || node);
      } else return null;
      return matches.length === 1 && isOriginalReply(matches[0]) ? matches[0] : null;
    }
    let sawPressed = false;
    let userInteracted = false;
    let siteBuffered = false;
    let stopRequested = false;
    let started = false;
    let uiActive = false;
    let buffering = false;
    let player = null;
    let endedDuringRebuild = false;
    let disposed = false;
    let idleDeadline;
    let detachedDeadline;
    let siteEndQueued = false;
    const visibleAlerts = () => [...doc.querySelectorAll('[role="alert"], [aria-live="assertive"]')]
      .filter(node => node.getClientRects().length && !node.closest('[hidden], [aria-hidden="true"], [inert]'))
      .map(node => (node.textContent || "").trim().slice(0, 240)).filter(Boolean);
    const initialAlerts = new Set(visibleAlerts());
    const competingAudio = () => [...doc.querySelectorAll("audio, video")].some(node =>
      node !== player && !node.paused && !node.ended && !node.muted && node.volume > 0);
    const listeners = new win.AbortController();
    const observer = new win.MutationObserver(check);
    const observedChanges = { childList: true, subtree: true, attributes: true,
      attributeFilter: ["aria-label", "title", "aria-pressed", "aria-checked", "data-playback-state"] };
    const replacementObserver = new win.MutationObserver(() => { if (!turn.isConnected) check(); });
    const watchdog = win.setInterval(check, 500);
    const startDeadline = win.setTimeout(() => {
      check();
      if (!started && (recoverTurn ? !disposed : validContext())) fail("ChatGPT did not confirm automatic playback. Your microphone is off.", "start-unconfirmed");
    }, 12000);
    const observationDeadline = win.setTimeout(() => fail(
      "Playback observation expired. Restart listening when the reply has finished."
    ), 30 * 60 * 1000);

    function cleanup() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      replacementObserver.disconnect();
      listeners.abort();
      win.clearInterval(watchdog);
      win.clearTimeout(startDeadline);
      win.clearTimeout(observationDeadline);
      win.clearTimeout(idleDeadline);
      win.clearTimeout(detachedDeadline);
    }
    function fail(message, reason = started ? "interrupted" : "start-failed") {
      if (disposed) return;
      cleanup();
      onError(message, reason);
    }
    function start() {
      if (started || disposed) return;
      started = true;
      win.clearTimeout(startDeadline);
      onStart();
    }
    function finish() {
      if (!started || disposed) return;
      if (!validContext()) return;
      cleanup();
      onEnd();
    }
    function validContext() {
      if (disposed) return false;
      if (doc.hidden || (win.location.href !== location && !samePage?.())) {
        fail("The reply is no longer active. Return to the conversation and restart listening.", "context-changed");
        return false;
      }
      if (turn.isConnected && isOriginalReply(turn)) {
        win.clearTimeout(detachedDeadline);
        detachedDeadline = undefined;
        return true;
      }
      const replacement = recoverTurn ? recoverTurn() : resolveReply();
      if (!replacement) {
        detachedDeadline ??= win.setTimeout(() => fail(
          recoverTurn ? "The chat was rebuilt and I lost the reply." :
            "The reply is no longer active. Return to the conversation and restart listening.", "context-changed"
        ), recoverTurn ? 10000 : 500);
        return false;
      }
      win.clearTimeout(detachedDeadline);
      detachedDeadline = undefined;
      if (turn !== replacement) {
        turn = replacement;
        observer.disconnect();
        observer.observe(turn, observedChanges);
      }
      return true;
    }
    function uncertainEnd() {
      // The DOM may update just before the browser delivers its native ended event.
      // This timer only reports an inconclusive result. It cannot call onEnd.
      if (idleDeadline !== undefined) return;
      idleDeadline = win.setTimeout(() => fail(
        "Read Aloud stopped without confirming a finish. Restart listening when you’re ready."
      ), 500);
    }
    function finishFromSite() {
      if (siteEndQueued) return;
      siteEndQueued = true;
      // Re-read the rendered state after this UI update. Elapsed time is never
      // evidence of an ending. A detached player's silent failure can still look
      // identical to natural completion if ChatGPT exposes only this toggle.
      win.requestAnimationFrame(() => {
        siteEndQueued = false;
        if (!validContext()) return;
        if (turnControls().length === 1 && turnControls()[0] === toggle && flag(toggle) === "false" &&
            stateOf(toggle) === "idle" && !player && !userInteracted && !siteBuffered &&
            !competingAudio() && win.navigator.onLine !== false && win.navigator.mediaSession?.playbackState !== "paused" &&
            !visibleAlerts().some(message => !initialAlerts.has(message))) {
          finish();
        } else {
          uncertainEnd();
        }
      });
    }
    function check() {
      if (!validContext()) return;
      if (player && !player.isConnected) {
        uncertainEnd();
      }
      const controls = turnControls();
      if (controls.length > 1) {
        fail("Several Read aloud buttons appeared. I couldn’t identify the active player.", "ambiguous");
        return;
      }
      const state = controls.length ? stateOf(controls[0]) : "";
      if (endedDuringRebuild && player?.ended && !buffering &&
          !["active","buffering","interrupted"].includes(state) && !competingAudio()) {
        finish();
        return;
      }
      if (firstButton && controls.length === 1 && controls[0] !== toggle &&
          (!toggle || !toggle.isConnected) && !firstButton.isConnected &&
          (firstButton.getAttribute("data-testid") ? controls[0].getAttribute("data-testid") === firstButton.getAttribute("data-testid")
            : readAction.test(name(controls[0]))) &&
          (flag(controls[0]) === "true" || (!uiActive && flag(controls[0]) === "false"))) {
        // A fresh unchecked button may simply be a rerender default. Its own
        // active state must be observed before its idle state can finish a turn.
        toggle = controls[0];
        sawPressed = false;
      }
      if (state === "buffering" && started) {
        siteBuffered = true;
      } else if (state === "interrupted" && (started || player)) {
        fail("Read Aloud was paused or stopped. Restart listening when you’re ready.");
      } else if (state === "active") {
        uiActive = true;
        if (controls[0] === toggle && flag(toggle) === "true") {
          sawPressed = true;
          win.clearTimeout(idleDeadline);
          idleDeadline = undefined;
        }
        start();
      } else if (state === "end" && uiActive && !buffering && (!player || player.ended)) {
        finish();
      } else if (uiActive && (state === "idle" || !controls.length)) {
        if (player?.ended && player.isConnected && !buffering) finish();
        else if (!player && sawPressed && controls[0] === toggle && flag(toggle) === "false") finishFromSite();
        else uncertainEnd();
      }
    }

    // Detached Audio objects and Web Audio never send media events through the
    // document. A global player is attributable only when the turn links to it.
    function belongsToReply(media) {
      if (turn.contains(media) && !media.controls &&
          !media.closest('[data-message-author-role], [data-content-search-unit-key]')) return true;
      return turnControls().some(node =>
        (node.getAttribute("aria-controls") || "").split(/\s+/).some(id => id && doc.getElementById(id)?.contains(media)) ||
        (node.id && (media.getAttribute("aria-labelledby") || "").split(/\s+/).includes(node.id)));
    }
    function handleMedia(event) {
      const media = event.target;
      if (!(media instanceof win.HTMLAudioElement)) return;
      if (!validContext()) {
        // Only an ended event from the already attributed player is evidence.
        // The first question and reply must remount before check() accepts it.
        if (recoverTurn && !disposed && media === player && event.type === "ended" && media.ended && !buffering) endedDuringRebuild = true;
        return;
      }
      if (media !== player && !belongsToReply(media)) return;
      if (event.type === "playing" && !media.paused && !media.ended) {
        if (player && player !== media && !player.ended) {
          fail("More than one player started for this reply. The microphone is off.");
          return;
        }
        if (recoverTurn && media !== player) media.addEventListener("ended", handleMedia, {signal:listeners.signal});
        player = media;
        buffering = false;
        start();
        return;
      }
      if (event.type === "error" || (player === media && ["emptied", "abort", "seeking"].includes(event.type))) {
        fail("Read aloud was interrupted. The microphone is off.");
        return;
      }
      if (player !== media) return;
      if (event.type === "waiting" || event.type === "stalled") buffering = true;
      if (event.type === "pause" && !media.ended) fail("Playback paused. Restart listening when you’re ready.");
      if (event.type === "ended" && media.ended && !buffering &&
          !turnControls().some(node => stateOf(node) === "active")) finish();
    }
    function userPlaybackAction(event) {
      if (!event.isTrusted || isViewGesture?.(event)) return;
      if (started) userInteracted = true;
      if (event.type === "keydown" && !["Enter", " ", "Escape", "MediaPause", "MediaStop", "MediaPlayPause"].includes(event.key)) return;
      const node = event.target instanceof win.Element ? event.target.closest(actions + ", audio") : null;
      if ((node && (isRead(node) || node === player || /^(?:stop|pause|cancel playback)$/i.test(name(node)))) ||
          (event.type === "keydown" && /^(?:Escape|Media)/.test(event.key))) {
        fail("Playback was changed manually. Restart listening when you’re ready.", "user-interrupted");
      }
    }
    const capture = { capture: true, signal: listeners.signal };
    for (const type of ["playing", "waiting", "stalled", "pause", "ended", "error", "emptied", "abort", "seeking"]) {
      doc.addEventListener(type, handleMedia, capture);
    }
    for (const type of ["pointerdown", "click", "keydown"]) doc.addEventListener(type, userPlaybackAction, capture);
    doc.addEventListener("visibilitychange", validContext, capture);
    win.addEventListener("offline", () => fail("The connection went offline. Restart listening when you’re ready.", "offline"), capture);
    win.addEventListener("pagehide", () => fail("Playback left this page. Restart listening when you return.", "context-changed"), capture);
    observer.observe(turn, observedChanges);
    if (pairKey || turnId || messageId) replacementObserver.observe(doc.documentElement, { childList: true, subtree: true });
    const alreadyPlaying = initialControls.some(node => ["active", "buffering"].includes(stateOf(node))) || competingAudio();
    if (alreadyPlaying) win.queueMicrotask(() => fail(
      "Playback was already active. Finish the reply, then restart listening.", "already-playing"
    ));
    cleanup.stopPlayback = () => {
      // Explicit end only. The controller detaches the observer first.
      if (stopRequested || alreadyPlaying) return;
      stopRequested = true;
      const controls = turn.isConnected ? turnControls() : [];
      if (controls.length === 1 && stateOf(controls[0]) === "active" && (uiActive || controls[0] === toggle)) {
        controls[0].click();
      } else if (player && !player.paused && !player.ended) {
        player.pause();
      }
    };
    return cleanup;
  };
})();
