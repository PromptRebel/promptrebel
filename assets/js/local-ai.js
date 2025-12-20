// assets/js/local-ai.js
// PromptRebel Local-AI Widget (WebLLM / WebGPU)
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

// ---- Guard: prevent double init (double script tag / navigation) ----
if (window.__PROMPTREBEL_LOCAL_AI__) {
  // already initialized
} else {
  window.__PROMPTREBEL_LOCAL_AI__ = true;

  // ========= Config =========
  const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

  // Hard limits (stability)
  const HISTORY_MAX_TURNS = 2;              // 0–2 turns as requested
  const HISTORY_MAX_MSGS = HISTORY_MAX_TURNS * 2; // user+assistant per turn => 4
  const MAX_SENTENCES = 3;                 // 2–3 Sätze
  const MAX_TOKENS = 140;                  // extra safety; adjust if needed

  // ========= Knowledge index (your structure: assets/knowledge/*.md) =========
  // local-ai.js is in assets/js/ -> ../knowledge/... resolves to assets/knowledge/...
  const KNOWLEDGE = {
    about:     new URL("../knowledge/about.md", import.meta.url).href,
    faq:       new URL("../knowledge/faq.md", import.meta.url).href,
    licensing: new URL("../knowledge/licensing.md", import.meta.url).href,
    music:     new URL("../knowledge/music.md", import.meta.url).href,
    visuals:   new URL("../knowledge/visuals.md", import.meta.url).href,
    video:     new URL("../knowledge/video.md", import.meta.url).href,
    tools:     new URL("../knowledge/tools.md", import.meta.url).href,
    stories:   new URL("../knowledge/stories.md", import.meta.url).href,
  };

  const knowledgeCache = new Map(); // key -> text

  async function loadKnowledge(keys) {
    const out = [];
    for (const k of keys) {
      if (!KNOWLEDGE[k]) continue;

      if (!knowledgeCache.has(k)) {
        const res = await fetch(KNOWLEDGE[k], { cache: "force-cache" });
        if (!res.ok) throw new Error(`Knowledge fetch failed: ${k} (${res.status})`);
        const txt = (await res.text()) || "";
        knowledgeCache.set(k, txt.trim());
      }
      out.push({ key: k, text: knowledgeCache.get(k) });
    }
    return out;
  }

  // ========= Step A: Router (LLM classify) =========
  const ROUTER_SYSTEM = `
Du bist ein Router. Du klassifizierst nur, du beantwortest NICHT die Frage.
Gib ausschließlich gültiges JSON zurück:
{"sources":["licensing","faq"]}

Erlaubte sources:
about, faq, licensing, music, visuals, video, tools, stories

Regeln:
- Wähle 1 bis 3 sources.
- Wenn unklar: ["faq"].
- Keine Erklärtexte, nur JSON.
`.trim();

  function safeParseRouterJSON(raw) {
    if (!raw) return null;
    const t = raw.trim();
    try { return JSON.parse(t); } catch {}
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch {}
    return null;
  }

  // fallback (wenn Router spinnt)
  function ruleFallback(question) {
    const q = (question || "").toLowerCase();
    if (q.includes("lizenz") || q.includes("license") || q.includes("cc") || q.includes("by-nc-sa")) return ["licensing", "faq"];
    if (q.includes("musik") || q.includes("audio") || q.includes("riffusion") || q.includes("soundcloud")) return ["music", "faq"];
    if (q.includes("bild") || q.includes("visual") || q.includes("cover")) return ["visuals", "faq"];
    if (q.includes("video") || q.includes("sora")) return ["video", "faq"];
    if (q.includes("tool") || q.includes("app") || q.includes("game") || q.includes("waste")) return ["tools", "faq"];
    if (q.includes("story") || q.includes("hörbuch") || q.includes("welt")) return ["stories", "faq"];
    if (q.includes("wer bist du") || q.includes("promptrebel") || q.includes("was ist")) return ["about", "faq"];
    return ["faq"];
  }

  // ========= Step B: Answer system prompt =========
  const BASE_SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI", ein lokaler Assistent für die Website PromptRebel.

WICHTIG:
- Antworte NUR anhand des WISSENSKONTEXTS unten. Wenn dort nichts steht: sage ehrlich "Ich weiß es nicht" und nenne kurz, welche Info fehlt.
- Keine Vermutungen, keine erfundenen Fakten.
- Antworte in 2 bis 3 Sätzen (maximal 3).
- Wenn möglich: nenne die relevante Quelle (z.B. "laut licensing.md").
`.trim();

  function buildCombinedSystem(knowledgeContext) {
    return `${BASE_SYSTEM_PROMPT}\n\nWISSENSKONTEXT:\n${knowledgeContext}\n`;
  }

  // ========= Helpers =========
  function hasWebGPU() { return !!navigator.gpu; }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function trimToMaxSentences(text, maxSentences = 3) {
    const t = (text || "").trim();
    if (!t) return t;

    // naive sentence split (good enough for DE/EN)
    const parts = t.split(/(?<=[.!?])\s+/);
    if (parts.length <= maxSentences) return t;

    return parts.slice(0, maxSentences).join(" ").trim();
  }

  function clampHistory(chatHistory) {
    // keep only last HISTORY_MAX_MSGS entries
    while (chatHistory.length > HISTORY_MAX_MSGS) chatHistory.shift();
  }

  // ========= CSS =========
  const style = document.createElement("style");
  style.textContent = `
  .pr-ai-btn{
    position:fixed; right:16px; bottom:16px; z-index:999999;
    border:1px solid rgba(148,163,184,.35);
    background:rgba(15,23,42,.88);
    color:#e5e7eb; border-radius:999px;
    padding:10px 14px; font:600 13px/1 system-ui;
    backdrop-filter: blur(10px);
    box-shadow:0 10px 30px rgba(2,6,23,.7);
    cursor:pointer;
  }
  .pr-ai-btn:hover{
    border-color: rgba(34,211,238,.8);
    box-shadow:0 0 18px rgba(34,211,238,.35), 0 10px 30px rgba(2,6,23,.7);
  }

  .pr-ai-panel{
    position:fixed; right:16px; bottom:68px; z-index:999999;
    width:min(420px, calc(100vw - 32px));
    height:min(680px, calc(100vh - 96px));
    display:none; flex-direction:column;
    border-radius:20px; overflow:hidden;
    border:1px solid rgba(148,163,184,.28);
    background:rgba(2,6,23,.92);
    box-shadow:0 20px 60px rgba(2,6,23,.75);
    backdrop-filter: blur(14px);
  }
  .pr-ai-panel.open{ display:flex; }

  .pr-ai-top{
    display:flex; align-items:center; justify-content:space-between;
    padding:10px 12px; gap:10px;
    background:linear-gradient(to bottom, rgba(15,23,42,.92), rgba(15,23,42,.55));
    border-bottom:1px solid rgba(148,163,184,.15);
    font:700 13px/1 system-ui; color:#e5e7eb;
  }
  .pr-ai-top small{ font-weight:600; color:#94a3b8; }

  .pr-ai-x{
    border:1px solid rgba(148,163,184,.25);
    background:rgba(15,23,42,.7);
    color:#e5e7eb; border-radius:999px;
    padding:6px 10px; cursor:pointer; font:700 12px/1 system-ui;
  }
  .pr-ai-x[disabled]{ opacity:.55; cursor:not-allowed; }

  .pr-ai-body{
    display:flex;
    flex-direction:column;
    gap:10px;
    padding:12px;
    height:100%;
    min-height:0;
  }

  .pr-ai-note{
    font:12px/1.35 system-ui; color:#94a3b8;
    border:1px solid rgba(148,163,184,.14);
    background:rgba(15,23,42,.55);
    padding:10px 12px; border-radius:14px;
  }
  .pr-ai-progress{ font:12px/1.35 system-ui; color:#94a3b8; }

  .pr-ai-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .pr-ai-action{
    border-radius:999px; padding:8px 10px;
    border:1px solid rgba(148,163,184,.22);
    background:rgba(15,23,42,.65);
    color:#e5e7eb; font:700 12px/1 system-ui;
    cursor:pointer;
  }
  .pr-ai-action[disabled]{ opacity:.55; cursor:not-allowed; }

  .pr-ai-msgs{
    flex:1;
    min-height:0;
    overflow-y:auto;
    padding:12px;
    padding-bottom:96px;
    display:flex;
    flex-direction:column;
    gap:10px;
    font:13px/1.45 system-ui;
    color:#e5e7eb;
  }

  .pr-ai-bubble{
    max-width:92%;
    padding:10px 12px;
    border-radius:14px;
    border:1px solid rgba(148,163,184,.18);
    background:rgba(15,23,42,.7);
    white-space:pre-wrap;
  }
  .pr-ai-bubble.user{ align-self:flex-end; border-color: rgba(34,211,238,.22); }
  .pr-ai-bubble.ai{ align-self:flex-start; border-color: rgba(236,72,153,.22); }

  .pr-ai-row{
    position:sticky;
    bottom:0;
    display:flex;
    gap:8px;
    padding:12px;
    margin-top:12px;
    background: rgba(2,6,23,.88);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(148,163,184,.15);
  }

  .pr-ai-input{
    flex:1; border-radius:999px;
    border:1px solid rgba(148,163,184,.22);
    background:rgba(15,23,42,.75);
    color:#e5e7eb; padding:10px 12px;
    outline:none; font:600 13px/1 system-ui;
  }
  .pr-ai-input[disabled]{ opacity:.55; cursor:not-allowed; }

  .pr-ai-send{
    border-radius:999px; padding:10px 12px;
    border:1px solid rgba(34,211,238,.35);
    background:rgba(15,23,42,.75);
    color:#e5e7eb; font:800 13px/1 system-ui;
    cursor:pointer;
  }
  .pr-ai-send[disabled]{ opacity:.55; cursor:not-allowed; }
  `;
  document.head.appendChild(style);

  // ========= Engine / state =========
  let engine = null;
  let ready = false;
  let starting = false;
  let busy = false;          // Single-Flight lock (Step A+B)
  let fatalDisposed = false; // if WebGPU got reset/disposed

  const chatHistory = []; // only user/assistant messages (max 2 turns)

  // ========= UI init =========
  function initUI() {
    if (document.querySelector(".pr-ai-btn") || document.querySelector(".pr-ai-panel")) return;

    const btn = document.createElement("button");
    btn.className = "pr-ai-btn";
    btn.type = "button";
    btn.textContent = "Local AI";

    const panel = document.createElement("div");
    panel.className = "pr-ai-panel";
    panel.innerHTML = `
      <div class="pr-ai-top">
        <div>PromptRebel Local AI <small>· läuft lokal (WebGPU)</small></div>
        <button class="pr-ai-x" type="button" aria-label="Close">×</button>
      </div>
      <div class="pr-ai-body">
        <div class="pr-ai-note">
          <b>Experiment:</b> Läuft lokal im Browser via <b>WebGPU</b>. Beim ersten Start wird ein Modell geladen (100MB+ möglich).
        </div>

        <div class="pr-ai-actions">
          <button class="pr-ai-action" type="button" data-action="start">Start (Model laden)</button>
          <button class="pr-ai-action" type="button" data-action="clear">Chat löschen</button>
        </div>

        <div class="pr-ai-progress" id="prAiProgress"></div>

        <div class="pr-ai-msgs" id="prAiMsgs"></div>

        <div class="pr-ai-row">
          <input class="pr-ai-input" id="prAiInput" placeholder="Frage zu PromptRebel…" />
          <button class="pr-ai-send" type="button" id="prAiSend">Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector(".pr-ai-x");
    const progressEl = panel.querySelector("#prAiProgress");
    const msgsEl = panel.querySelector("#prAiMsgs");
    const inputEl = panel.querySelector("#prAiInput");
    const sendEl = panel.querySelector("#prAiSend");
    const startBtn = panel.querySelector('[data-action="start"]');
    const clearBtn = panel.querySelector('[data-action="clear"]');

    function setBusy(on) {
      busy = !!on;
      sendEl.toggleAttribute("disabled", busy);
      inputEl.toggleAttribute("disabled", busy);
      startBtn.toggleAttribute("disabled", busy);
      clearBtn.toggleAttribute("disabled", busy);
      closeBtn.toggleAttribute("disabled", busy);
      // optional: also block closing while busy by ignoring click (see handler below)
    }

    function addBubble(text, who) {
      const d = document.createElement("div");
      d.className = `pr-ai-bubble ${who}`;
      d.textContent = text;
      msgsEl.appendChild(d);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return d;
    }

    function initProgressCallback(p) {
      const msg = typeof p === "string" ? p : JSON.stringify(p);
      progressEl.textContent = `Loading: ${msg}`;
    }

    function markDisposed() {
      fatalDisposed = true;
      ready = false;
      engine = null;
      progressEl.textContent = "WebGPU/Engine wurde zurückgesetzt (disposed). Bitte „Start“ erneut klicken.";
    }

    async function startModel() {
      if (starting || busy) return;
      if (ready && engine && !fatalDisposed) return;

      if (!hasWebGPU()) {
        progressEl.textContent =
          "WebGPU nicht verfügbar. Nutze Desktop (Chrome/Edge) oder Safari mit WebGPU aktiviert.";
        return;
      }

      starting = true;
      fatalDisposed = false;
      setBusy(true);
      progressEl.textContent = "Initialisiere…";

      try {
        engine = new MLCEngine({ initProgressCallback });
        await engine.reload(DEFAULT_MODEL);
        ready = true;
        progressEl.textContent = "Bereit.";

        msgsEl.innerHTML = "";
        chatHistory.length = 0;

        addBubble("Hi! Stell mir eine Frage – ich lade das passende Wissen dynamisch.", "ai");
      } catch (e) {
        console.error(e);
        progressEl.textContent = "Fehler beim Laden des Modells. (Konsole prüfen)";
        // If it smells like disposed -> mark
        const msg = String(e?.message || e || "");
        if (msg.toLowerCase().includes("disposed")) markDisposed();
      } finally {
        starting = false;
        setBusy(false);
      }
    }

    // Step A: classify via LLM (no stream)
    async function classifySources(question) {
      if (!engine || !ready) return ruleFallback(question);

      try {
        const r = await engine.chat.completions.create({
          messages: [
            { role: "system", content: ROUTER_SYSTEM },
            { role: "user", content: question }
          ],
          temperature: 0,
          stream: false,
          max_tokens: 60,
        });

        const raw = r?.choices?.[0]?.message?.content?.trim() || "";
        const json = safeParseRouterJSON(raw);
        const sources = Array.isArray(json?.sources) ? json.sources : ruleFallback(question);

        const allowed = new Set(Object.keys(KNOWLEDGE));
        const cleaned = sources.filter(s => allowed.has(s)).slice(0, 3);
        return cleaned.length ? cleaned : ruleFallback(question);
      } catch (e) {
        console.warn("Router failed, using fallback", e);
        return ruleFallback(question);
      }
    }

    async function answerWithKnowledge(aiBubble, sources) {
      // load selected docs
      const docs = await loadKnowledge(sources);

      const knowledgeContext = docs
        .map(d => `### ${d.key.toUpperCase()}\n${d.text}`)
        .join("\n\n")
        .trim();

      const combinedSystem = buildCombinedSystem(knowledgeContext);

      // Keep history tiny (0–2 turns)
      clampHistory(chatHistory);

      const scopedMessages = [
        { role: "system", content: combinedSystem },
        ...chatHistory
      ];

      // stream response
      const chunks = await engine.chat.completions.create({
        messages: scopedMessages,
        temperature: 0.2,
        stream: true,
        max_tokens: MAX_TOKENS,
      });

      let reply = "";
      for await (const chunk of chunks) {
        const delta = chunk.choices?.[0]?.delta?.content || "";
        if (delta) {
          reply += delta;
          aiBubble.textContent = reply;
          msgsEl.scrollTop = msgsEl.scrollHeight;
        }
      }

      // hard trim to max sentences (even if model ignores)
      const trimmed = trimToMaxSentences(reply, MAX_SENTENCES);
      if (trimmed !== reply) aiBubble.textContent = trimmed;

      return trimmed;
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;

      if (busy) return;

      if (!ready || !engine || fatalDisposed) {
        addBubble("Model ist nicht bereit. Klicke zuerst auf „Start (Model laden)“.", "ai");
        return;
      }

      setBusy(true);

      inputEl.value = "";
      addBubble(text, "user");

      // AI bubble that changes state:
      const aiBubble = addBubble("Denke nach…", "ai");

      try {
        // Add user message to history first
        chatHistory.push({ role: "user", content: text });
        clampHistory(chatHistory);

        // Step A (classify)
        const sources = await classifySources(text);

        // Small cooldown between A and B (helps with WebGPU internal state)
        aiBubble.textContent = "Suche Wissen…";
        await sleep(100);

        // Step B (answer)
        const finalAnswer = await answerWithKnowledge(aiBubble, sources);

        // Store assistant reply
        chatHistory.push({ role: "assistant", content: finalAnswer });
        clampHistory(chatHistory);
      } catch (e) {
        console.error(e);
        const msg = String(e?.message || e || "");
        if (msg.toLowerCase().includes("disposed")) {
          aiBubble.textContent = "WebGPU-Ressourcen wurden zurückgesetzt („disposed“). Bitte „Start“ erneut klicken.";
          markDisposed();
        } else {
          aiBubble.textContent = "Fehler beim Antworten. (Konsole prüfen)";
        }
      } finally {
        setBusy(false);
      }
    }

    // ========= wiring =========
    btn.addEventListener("click", () => panel.classList.toggle("open"));

    closeBtn.addEventListener("click", () => {
      if (busy) return; // don't allow closing while generating
      panel.classList.remove("open");
    });

    startBtn.addEventListener("click", startModel);

    clearBtn.addEventListener("click", () => {
      if (busy) return;
      msgsEl.innerHTML = "";
      progressEl.textContent = ready ? "Bereit." : "";
      chatHistory.length = 0;
      addBubble("Chat gelöscht.", "ai");
    });

    sendEl.addEventListener("click", sendMessage);

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // Init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI, { once: true });
  } else {
    initUI();
  }
}
