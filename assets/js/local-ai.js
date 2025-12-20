// assets/js/local-ai.js
// PromptRebel Local-AI Widget (WebLLM / WebGPU) – STABLE baseline
// Uses a smaller default model for stability on Windows/WebGPU.
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

// ---- Guard: prevent double init (double script tag / navigation) ----
if (window.__PROMPTREBEL_LOCAL_AI__) {
  // already initialized
} else {
  window.__PROMPTREBEL_LOCAL_AI__ = true;

  // ========= Config =========
  // Stable default model:
  const DEFAULT_MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

  // Stability limits
  const HISTORY_MAX_MSGS = 2;        // keep only last 2 messages total (user+assistant)
  const MAX_TOKENS = 256;            // keep answers short-ish (stability)
  const KNOWLEDGE_MAX_CHARS = 6400;  // cap injected knowledge
  const MAX_SENTENCES = 3;           // enforce 2–3 sentences

  // ========= Knowledge index (assets/knowledge/*.md) =========
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
    extras:   new URL("../knowledge/extras.md", import.meta.url).href,
  };

  const knowledgeCache = new Map(); // key -> text

  async function loadKnowledge(keys) {
    const out = [];
    for (const k of keys) {
      if (!KNOWLEDGE[k]) continue;

      if (!knowledgeCache.has(k)) {
        const res = await fetch(KNOWLEDGE[k], { cache: "force-cache" });
        if (!res.ok) throw new Error(`Knowledge fetch failed: ${k} (${res.status})`);
        const txt = ((await res.text()) || "").trim();
        knowledgeCache.set(k, txt);
      }
      out.push({ key: k, text: knowledgeCache.get(k) });
    }
    return out;
  }

  // ========= Routing (NO LLM) =========
  function pickSourcesHeuristic(question) {
    const q = (question || "").toLowerCase();

    if (q.includes("lizenz") || q.includes("license") || q.includes("cc") || q.includes("by-nc-sa"))
      return ["licensing", "faq"];

    if (q.includes("musik") || q.includes("audio") || q.includes("riffusion") || q.includes("soundcloud"))
      return ["music", "faq"];

    if (q.includes("bild") || q.includes("visual") || q.includes("cover"))
      return ["visuals", "faq"];

    if (q.includes("video") || q.includes("sora"))
      return ["video", "faq"];

    if (q.includes("tool") || q.includes("app") || q.includes("game") || q.includes("waste"))
      return ["tools", "faq"];

    if (q.includes("story") || q.includes("hörbuch") || q.includes("welt"))
      return ["stories", "faq"];

    if (q.includes("wer bist du") || q.includes("promptrebel") || q.includes("was ist"))
      return ["about", "faq"];

    if (q.includes("extras") || q.includes("discord") || q.includes("prompting"))
      return ["extras"];

    return ["faq"];
  }

  // ========= Prompts =========
  const BASE_SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI", ein lokaler Assistent für die Website PromptRebel.

Regeln:
- Antworte NUR anhand des WISSENSKONTEXTS unten.
- Antworte locker und freundlich, ohne Slang.
- Verwende maximal 1 passendes Emoji, wenn es natürlich wirkt (z. B. bei Begrüßung oder Erklärung).
- Keine Emoji-Ketten, kein Spam.
- Wenn dort nicht genug steht: sage ehrlich "Ich weiß es nicht" und nenne kurz, welche Info fehlt.
- Keine Vermutungen, keine erfundenen Fakten.
- Antworte in 2 bis 3 Sätzen (maximal 3).
- Wenn möglich: nenne die relevante Datei (z.B. "laut licensing.md").
`.trim();

  function buildCombinedSystem(knowledgeContext) {
    return `${BASE_SYSTEM_PROMPT}\n\nWISSENSKONTEXT:\n${knowledgeContext}\n`;
  }

  // ========= Helpers =========
  function hasWebGPU() { return !!navigator.gpu; }

  function trimToMaxSentences(text, maxSentences = 3) {
    const t = (text || "").trim();
    if (!t) return t;
    const parts = t.split(/(?<=[.!?])\s+/);
    if (parts.length <= maxSentences) return t;
    return parts.slice(0, maxSentences).join(" ").trim();
  }

  function clampHistory(history) {
    while (history.length > HISTORY_MAX_MSGS) history.shift();
  }

  function shortenKnowledge(docs, question) {
    const q = (question || "").toLowerCase();
    const words = q.split(/[^a-zäöüß0-9]+/i).filter(w => w.length >= 4).slice(0, 8);

    let combined = docs.map(d => `### ${d.key.toUpperCase()}\n${d.text}`).join("\n\n");
    if (combined.length <= KNOWLEDGE_MAX_CHARS) return combined;

    const lines = combined.split("\n");
    const kept = [];
    for (const line of lines) {
      const l = line.toLowerCase();

      // keep headers + bullets early
      if (kept.length < 24 && (l.startsWith("### ") || l.startsWith("-") || l.startsWith("•"))) {
        kept.push(line);
      } else if (words.some(w => l.includes(w))) {
        kept.push(line);
      }

      if (kept.join("\n").length >= KNOWLEDGE_MAX_CHARS) break;
    }

    const out = kept.join("\n");
    return out.length ? out.slice(0, KNOWLEDGE_MAX_CHARS) : combined.slice(0, KNOWLEDGE_MAX_CHARS);
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
    display:flex; flex-direction:column; gap:10px;
    padding:12px; height:100%; min-height:0;
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
    flex:1; min-height:0; overflow-y:auto;
    padding:12px; padding-bottom:96px;
    display:flex; flex-direction:column; gap:10px;
    font:13px/1.45 system-ui; color:#e5e7eb;
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
    position:sticky; bottom:0;
    display:flex; gap:8px;
    padding:12px; margin-top:12px;
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
  let busy = false;

  const chatHistory = []; // minimal

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
        <div>PromptRebel Local AI <small>· Modell: ${DEFAULT_MODEL}</small></div>
        <button class="pr-ai-x" type="button" aria-label="Close">×</button>
      </div>
      <div class="pr-ai-body">
        <div class="pr-ai-note">
          <b>Stabiler Modus:</b> Kleineres Modell als Standard. Antworten basieren nur auf den MD-Dateien (Wissenskontext).
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

    async function startModel() {
      if (starting || busy) return;
      if (ready && engine) return;

      if (!hasWebGPU()) {
        progressEl.textContent =
          "WebGPU nicht verfügbar. Nutze Desktop (Chrome/Edge) oder Safari mit WebGPU aktiviert.";
        return;
      }

      starting = true;
      setBusy(true);
      progressEl.textContent = "Initialisiere…";

      try {
        engine = new MLCEngine({ initProgressCallback });
        await engine.reload(DEFAULT_MODEL);
        ready = true;

        progressEl.textContent = "Bereit.";
        msgsEl.innerHTML = "";
        chatHistory.length = 0;

        addBubble("Hi! Stell mir eine Frage – ich nutze nur das passende Wissen aus den MD-Dateien.", "ai");
      } catch (e) {
        console.error(e);
        ready = false;
        engine = null;

        const msg = String(e?.message || e || "").toLowerCase();
        progressEl.textContent = msg.includes("disposed") || msg.includes("device") || msg.includes("hung")
          ? "WebGPU/Engine wurde zurückgesetzt. Bitte Seite neu laden und Start erneut klicken."
          : "Fehler beim Laden des Modells. (Konsole prüfen)";
      } finally {
        starting = false;
        setBusy(false);
      }
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || busy) return;

      if (!ready || !engine) {
        addBubble("Model ist nicht bereit. Klicke zuerst auf „Start (Model laden)“.", "ai");
        return;
      }

      setBusy(true);
      inputEl.value = "";

      addBubble(text, "user");
      const aiBubble = addBubble("Suche Wissen…", "ai");

      try {
        // Minimal history
        chatHistory.push({ role: "user", content: text });
        clampHistory(chatHistory);

        const sources = pickSourcesHeuristic(text);

        const docs = await loadKnowledge(sources);
        const knowledgeContext = shortenKnowledge(docs, text);
        const system = buildCombinedSystem(knowledgeContext);

        aiBubble.textContent = "Antworte…";

        const scopedMessages = [{ role: "system", content: system }, ...chatHistory];

        const chunks = await engine.chat.completions.create({
          messages: scopedMessages,
          temperature: 0.1,
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

        const finalAnswer = trimToMaxSentences(reply, MAX_SENTENCES);
        aiBubble.textContent = finalAnswer || "Ich weiß es nicht (im Wissenskontext steht dazu nichts).";

        chatHistory.push({ role: "assistant", content: aiBubble.textContent });
        clampHistory(chatHistory);
      } catch (e) {
        console.error(e);
        const msg = String(e?.message || e || "").toLowerCase();

        if (msg.includes("disposed") || msg.includes("device") || msg.includes("hung")) {
          aiBubble.textContent = "WebGPU/Engine wurde zurückgesetzt. Bitte Seite neu laden und Start erneut klicken.";
          ready = false;
          engine = null;
          progressEl.textContent = "Engine nicht bereit (reset).";
        } else {
          aiBubble.textContent = "Fehler beim Antworten. (Konsole prüfen)";
        }
      } finally {
        setBusy(false);
      }
    }

    // wiring
    btn.addEventListener("click", () => panel.classList.toggle("open"));

    closeBtn.addEventListener("click", () => {
      if (busy) return;
      panel.classList.remove("open");
    });

    startBtn.addEventListener("click", startModel);

    clearBtn.addEventListener("click", () => {
      if (busy) return;
      msgsEl.innerHTML = "";
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
