// PromptRebel Local-AI Widget (WebLLM / WebGPU)
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine, prebuiltAppConfig } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

// ---- Guard: prevent double init (double script tag / navigation) ----
if (window.__PROMPTREBEL_LOCAL_AI__) {
  // already initialized
} else {
  window.__PROMPTREBEL_LOCAL_AI__ = true;

  // ========= Config =========
  const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

  // ========= System prompt =========
  const SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI", ein lokaler Assistent für die Website PromptRebel.
Du antwortest kurz, konkret und faktenbasiert. Wenn etwas nicht im Wissenskontext steht, sag das offen.

Kontext:
- PromptRebel ist ein persönliches KI-Labor (Musik, Visuals, Video, Tools, Stories).
- Inhalte sind experimentell, oft als Prototyp/Work-in-progress.
- Lizenz: CC BY-NC-SA 4.0 (nicht-kommerziell, Namensnennung, Weitergabe unter gleichen Bedingungen).

Aufgabe:
- Erkläre Navigation, Inhalte und Projekte.
- Gib praktische Hinweise (z.B. Prompt-Anpassung), aber erfinde keine Fakten.
`.trim();

  // ========= Knowledge index =========
  // local-ai.js liegt in /assets/js/
  // knowledge liegt in /assets/knowledge/
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
      const url = KNOWLEDGE[k];
      if (!url) continue;

      if (!knowledgeCache.has(k)) {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) throw new Error(`Knowledge fetch failed: ${k} (${res.status})`);
        const txt = await res.text();
        knowledgeCache.set(k, txt);
      }
      out.push({ key: k, text: knowledgeCache.get(k) });
    }
    return out;
  }

  // ========= Stable routing (NO LLM router) =========
  function pickSourcesByRules(question) {
    const q = (question || "").toLowerCase();

    // Lizenz / Recht
    if (q.includes("lizenz") || q.includes("license") || q.includes("cc") || q.includes("by-nc-sa")) {
      return ["licensing", "faq"];
    }

    // Musik / Audio
    if (q.includes("musik") || q.includes("audio") || q.includes("riffusion") || q.includes("soundcloud")) {
      return ["music", "faq"];
    }

    // Visuals / Bilder
    if (q.includes("bild") || q.includes("visual") || q.includes("cover") || q.includes("art")) {
      return ["visuals", "faq"];
    }

    // Video
    if (q.includes("video") || q.includes("sora")) {
      return ["video", "faq"];
    }

    // Tools / Apps / Game
    if (q.includes("tool") || q.includes("app") || q.includes("game") || q.includes("waste") || q.includes("wizard")) {
      return ["tools", "faq"];
    }

    // Stories
    if (q.includes("story") || q.includes("hörbuch") || q.includes("welt")) {
      return ["stories", "faq"];
    }

    // About / was ist promptrebel
    if (q.includes("wer bist du") || q.includes("was ist promptrebel") || q.includes("promptrebel")) {
      return ["about", "faq"];
    }

    return ["faq"];
  }

  // ========= UI/CSS =========
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
    flex:1; min-height:0;
    overflow-y:auto;
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

  function hasWebGPU() {
    return !!navigator.gpu;
  }

  // ========= Engine state (single instance) =========
  let engine = null;
  let ready = false;
  let starting = false;
  let generating = false;

  // Chat history: ONLY user/assistant (system is added per request)
  const history = [];

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
        <button class="pr-ai-x" type="button">×</button>
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

    function addBubble(text, who) {
      const d = document.createElement("div");
      d.className = `pr-ai-bubble ${who}`;
      d.textContent = text;
      msgsEl.appendChild(d);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function initProgressCallback(p) {
      const msg = typeof p === "string" ? p : JSON.stringify(p);
      progressEl.textContent = `Loading: ${msg}`;
    }

    async function startModel() {
      if (starting || generating) return;
      if (ready && engine) {
        progressEl.textContent = "Bereit.";
        return;
      }

      if (!hasWebGPU()) {
        progressEl.textContent =
          "WebGPU nicht verfügbar. Auf iPhone/iOS kann WebGPU je nach Version/Feature-Flag fehlen. Nutze Desktop (Chrome/Edge) oder Safari mit WebGPU aktiviert.";
        return;
      }

      starting = true;
      startBtn.setAttribute("disabled", "disabled");
      progressEl.textContent = "Initialisiere…";

      try {
        // Create engine once
        if (!engine) engine = new MLCEngine({ initProgressCallback });

        // optional existence check (no throw)
        prebuiltAppConfig.model_list?.some((m) => m.model_id === DEFAULT_MODEL || m.model === DEFAULT_MODEL);

        await engine.reload(DEFAULT_MODEL);
        ready = true;

        progressEl.textContent = "Bereit.";
        msgsEl.innerHTML = "";
        history.length = 0;

        addBubble("Hi! Frag mich etwas zu PromptRebel (Wissen wird dynamisch geladen).", "ai");
      } catch (e) {
        console.error(e);
        ready = false;
        progressEl.textContent = "Fehler beim Laden des Modells. (Konsole prüfen)";
      } finally {
        starting = false;
        startBtn.removeAttribute("disabled");
      }
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;

      if (!ready || !engine) {
        addBubble("Model ist noch nicht geladen. Klicke zuerst auf „Start (Model laden)“.", "ai");
        return;
      }

      if (generating) return; // hard lock against parallel requests

      generating = true;
      sendEl.setAttribute("disabled", "disabled");
      startBtn.setAttribute("disabled", "disabled");

      inputEl.value = "";
      addBubble(text, "user");
      history.push({ role: "user", content: text });

      const aiBubble = document.createElement("div");
      aiBubble.className = "pr-ai-bubble ai";
      aiBubble.textContent = "";
      msgsEl.appendChild(aiBubble);
      msgsEl.scrollTop = msgsEl.scrollHeight;

      try {
        // 1) pick sources (stable rules)
        const sources = pickSourcesByRules(text);

        // 2) load docs
        const docs = await loadKnowledge(sources);

        // 3) build knowledge context
        const knowledgeContext = docs
          .map(d => `### ${d.key.toUpperCase()}\n${d.text}`)
          .join("\n\n");

        // 4) IMPORTANT: system must be FIRST in messages
        const scopedMessages = [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content:
              "Nutze ausschließlich das folgende Wissen zur Beantwortung. " +
              "Wenn etwas nicht enthalten ist, sage offen, dass du es nicht weißt.\n\n" +
              knowledgeContext
          },
          ...history
        ];

        const chunks = await engine.chat.completions.create({
          messages: scopedMessages,
          temperature: 0.2,
          stream: true,
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

        history.push({ role: "assistant", content: reply || aiBubble.textContent || "" });
      } catch (e) {
        console.error(e);
        aiBubble.textContent =
          "Fehler beim Antworten. Tipp: Seite neu laden + Model neu starten. (Konsole prüfen)";
      } finally {
        generating = false;
        sendEl.removeAttribute("disabled");
        startBtn.removeAttribute("disabled");
      }
    }

    // wiring
    btn.addEventListener("click", () => panel.classList.toggle("open"));
    closeBtn.addEventListener("click", () => panel.classList.remove("open"));

    startBtn.addEventListener("click", startModel);

    clearBtn.addEventListener("click", () => {
      msgsEl.innerHTML = "";
      progressEl.textContent = ready ? "Bereit." : "";
      history.length = 0;
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
