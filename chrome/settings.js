(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const storage = api.storage.local;
  const form = document.querySelector("form");
  const el = id => document.getElementById(id);
  const providers = {elevenLabs: "ElevenLabs", fishAudio: "Fish Audio"};
  const sources = ["cove", "device", ...Object.keys(providers)];
  const choice = () => form.elements.source.value;
  const slot = source => "voice." + source;
  let preferences = {};
  let pickedVoice = false;
  const say = message => { el("status").textContent = message; };
  function voices() {
    const list = el("installed");
    // Once the person has chosen from this list, an empty value means "Device default",
    // and a refresh of the voice list must not swap the saved voice back in.
    const uri = pickedVoice ? list.value : list.value || preferences.deviceVoiceURI || "";
    list.replaceChildren(new Option("Device default", ""));
    const local = (globalThis.speechSynthesis?.getVoices() || []).filter(v => v.localService === true);
    for (const v of local) list.add(new Option(v.name + " · " + v.lang, v.voiceURI));
    if (uri && !local.some(v => v.voiceURI === uri)) list.add(new Option("Previously selected voice", uri));
    list.value = uri;
  }
  function draw() {
    const source = choice();
    el("provider").hidden = !providers[source];
    el("device").hidden = source !== "device";
    el("key").value = "";
    el("voice-id").value = preferences[slot(source)]?.id || "";
    if (!providers[source]) return;
    el("disclosure").textContent = "With this voice selected, Black Bubble sends the text of each completed reply to " +
      providers[source] + " for speech. Your key stays in this browser profile and is sent only to that provider.";
    const saved = Boolean(preferences[slot(source)]?.key);
    el("key-state").textContent = saved ? "A key is saved on this device." : "You can save the key now and add your voice later.";
    el("forget").hidden = !saved;
  }
  function readKey() {
    const key = el("key").value.trim();
    if (!/^[!-~]{1,1024}$/.test(key)) throw new Error("Paste your provider API key.");
    return key;
  }
  function voiceId(source, value) {
    let id = value.trim();
    if (id.includes("://")) {
      try {
        const url = new URL(id);
        const parts = url.pathname.split("/").filter(Boolean);
        if (url.protocol !== "https:" || url.username || url.password) return "";
        if (source === "elevenLabs" && ["elevenlabs.io","www.elevenlabs.io"].includes(url.hostname)) {
          id = url.searchParams.get("voiceId") || (parts.includes("share") ? parts.at(-1) : "");
        } else if (source === "fishAudio" && ["fish.audio","www.fish.audio"].includes(url.hostname)) {
          id = parts[0] === "m" ? parts[1] : "";
        } else return "";
      } catch { return ""; }
    }
    return typeof id === "string" && /^[a-zA-Z0-9_~-][a-zA-Z0-9_.~-]{0,199}$/.test(id) ? id : "";
  }
  async function save(values) {
    await storage.set(values);
    Object.assign(preferences, values);
  }
  async function action(task) {
    try { await task(); } catch (err) { say(err.message || "Could not save on this device."); }
  }
  el("choices").addEventListener("change", () => { draw(); say(""); });
  el("installed").addEventListener("change", () => { pickedVoice = true; });
  el("save-key").addEventListener("click", () => action(async () => {
    const source = choice(), name = slot(source);
    if (!providers[source]) return;
    await save({[name]: {...preferences[name], key: readKey()}});
    el("key").value = "";
    el("key-state").textContent = "A key is saved on this device.";
    el("forget").hidden = false;
    say("Key saved. Add the voice ID or link when you’re ready.");
  }));
  el("forget").addEventListener("click", () => action(async () => {
    const source = choice(), name = slot(source);
    if (!providers[source] || !window.confirm("Remove the saved " + providers[source] + " key from this browser?")) return;
    await save({[name]: {id: preferences[name]?.id || ""}, ...(preferences.source === source ? {source:"cove"} : {})});
    draw();
    say("Key removed.");
  }));
  form.addEventListener("submit", event => {
    event.preventDefault();
    action(async () => {
      const source = choice(), values = {source};
      if (!sources.includes(source)) throw new Error("Choose a voice first.");
      if (source === "device") values.deviceVoiceURI = el("installed").value;
      if (providers[source]) {
        const name = slot(source);
        const key = el("key").value.trim() ? readKey() : preferences[name]?.key;
        const id = voiceId(source, el("voice-id").value);
        if (!key) throw new Error("Paste or save an API key for " + providers[source] + ".");
        if (!id) throw new Error("Paste a voice ID or a voice share link from " + providers[source] + ".");
        values[name] = {id, key};
      }
      await save(values);
      draw();
      say("Voice saved. Return to your chat and start a new hands-free conversation.");
    });
  });
  globalThis.speechSynthesis?.addEventListener("voiceschanged", voices);
  form.inert = true;
  action(async () => {
    preferences = await storage.get(["source","deviceVoiceURI",...Object.keys(providers).map(slot)]);
    form.elements.source.value = sources.includes(preferences.source) ? preferences.source : "cove";
    voices();
    draw();
    form.inert = false;
  });
})();
