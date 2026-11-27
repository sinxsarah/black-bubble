// Runs only in the extension. Keep provider credentials out of the ChatGPT tab.
(() => {
  "use strict";
  const api = globalThis.browser || globalThis.chrome;
  const storage = api.storage.local;
  if (storage.setAccessLevel) {
    storage.setAccessLevel({accessLevel: "TRUSTED_CONTEXTS"}).catch(() => {});
  }
  const pending = new Map();
  const recent = new Map();
  const sources = new Set(["cove", "device", "elevenLabs", "fishAudio"]);
  const paidSources = new Set(["elevenLabs", "fishAudio"]);
  const maxBytes = 8 * 1024 * 1024;
  const configKey = source => "voice." + source;
  const validVoice = id => typeof id === "string" && /^[a-zA-Z0-9_~-][a-zA-Z0-9_.~-]{0,199}$/.test(id);

  async function selection() {
    const values = await storage.get(["source", "deviceVoiceURI"]);
    return {source: sources.has(values.source) ? values.source : "cove",
      deviceVoiceURI: typeof values.deviceVoiceURI === "string" ? values.deviceVoiceURI : ""};
  }

  function contentSender(sender) {
    if (!Number.isInteger(sender.tab?.id) || sender.frameId > 0 || (sender.id && sender.id !== api.runtime.id)) return false;
    try { return new URL(sender.url || sender.tab.url).origin === "https://chatgpt.com"; }
    catch { return false; }
  }

  function audioError(code) {
    if ([401, 403].includes(code)) return "Check your API key, speech permissions and access to this voice in Voice settings.";
    if (code === 402) return "Your voice provider needs more credits.";
    if ([400, 404, 422].includes(code)) return "Check the voice ID or try a shorter reply.";
    if (code === 429) return "Your voice provider reached a usage limit.";
    return "The voice provider could not generate this reply.";
  }

  function encodeMP3(bytes) {
    const tag = bytes.length > 10 && bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51;
    const frame = bytes.length >= 4 && bytes[0] === 255 && (bytes[1] & 224) === 224;
    if (!tag && !frame) throw new Error("The provider returned unreadable audio.");
    const parts = [];
    for (let i = 0; i < bytes.length; i += 16384) parts.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
    return btoa(parts.join(""));
  }

  async function readMP3(response) {
    if (!response.ok) throw new Error(audioError(response.status));
    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (type && !["audio/mpeg", "audio/mp3", "audio/x-mpeg", "application/octet-stream"].includes(type)) {
      throw new Error("The provider returned a response without MP3 audio.");
    }
    const tooLarge = () => new Error("This reply is too large. Try a shorter reading.");
    if (Number(response.headers.get("content-length")) > maxBytes) throw tooLarge();
    if (!response.body) throw new Error("The provider returned empty audio.");
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw tooLarge(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return {audioBase64: encodeMP3(bytes), mimeType: "audio/mpeg"};
  }

  async function synthesize(message, tabId) {
    const {source, text, id} = message;
    if (!paidSources.has(source) || typeof text !== "string" || !text.trim() ||
        text.length > 20000 || Array.from(text).length > 10000) throw new Error("Choose a reply of up to 10,000 characters.");
    if (typeof id !== "string" || !/^[A-Za-z0-9_.:-]{1,128}$/.test(id)) throw new Error("Invalid reading request.");
    const token = tabId + ":" + id;
    const now = Date.now();
    for (const [old, expires] of recent) if (expires <= now) recent.delete(old);
    if (recent.has(token) || pending.has(tabId)) throw new Error("A reading for this tab is already in progress or was requested.");
    const controller = new AbortController();
    pending.set(tabId, {token, controller});
    recent.set(token, now + 120000);
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const slot = configKey(source);
      const settings = await storage.get(["source", slot]);
      const config = settings[slot];
      if (settings.source !== source) throw new Error("The selected voice changed. Choose your voice and start the conversation again.");
      if (!validVoice(config?.id) || typeof config?.key !== "string" || !/^[!-~]{1,1024}$/.test(config.key)) {
        throw new Error("Save a voice and API key in Black Bubble’s Voice settings.");
      }
      const eleven = source === "elevenLabs";
      const endpoint = eleven ? "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(config.id) +
        "?output_format=mp3_44100_128" : "https://api.fish.audio/v1/tts";
      const headers = {"Content-Type": "application/json", Accept: "audio/mpeg"};
      if (eleven) headers["xi-api-key"] = config.key;
      else { headers.Authorization = "Bearer " + config.key; headers.model = "s2.1-pro"; }
      const body = eleven ? {text, model_id: "eleven_flash_v2_5"} :
        {text, reference_id: config.id, format: "mp3", latency: "balanced"};
      let response;
      try {
        response = await fetch(endpoint, {method: "POST", headers, body: JSON.stringify(body),
          credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal});
      } catch { throw new Error("The voice request stopped. Check your connection and provider settings."); }
      return await readMP3(response);
    } finally {
      clearTimeout(timer);
      controller.abort();
      pending.delete(tabId);
    }
  }

  const showSettings = () => api.tabs.create({url: api.runtime.getURL("settings.html")});
  api.action?.onClicked?.addListener(showSettings);
  api.tabs.onRemoved?.addListener(tabId => pending.get(tabId)?.controller.abort());
  api.runtime.onMessage.addListener((message, sender, reply) => {
    if (!contentSender(sender) || typeof message?.type !== "string" || !message.type.startsWith("blackBubble.")) return false;
    async function handle() {
      switch (message.type) {
        case "blackBubble.getSettings": return selection();
        case "blackBubble.openSettings": await showSettings(); return {};
        case "blackBubble.cancel": {
          const task = pending.get(sender.tab.id);
          if (task?.token === sender.tab.id + ":" + message.id) task.controller.abort();
          return {};
        }
        case "blackBubble.synthesize": return synthesize(message, sender.tab.id);
        default: throw new Error("Unknown Black Bubble action.");
      }
    }
    handle().then(reply, error => reply({error: error.message || "The reading could not finish."}));
    return true;
  });
})();
