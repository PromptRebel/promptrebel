// PromptRebel Local-AI Widget (WebLLM / WebGPU)
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

/* =========================
   1) Knowledge Index + Cache
   ========================= */
const KNOWLEDGE = {
  about: "./assets/knowledge/about.md",
  faq: "./assets/knowledge/faq.md",
  licensing: "./assets/knowledge/licensing.md",
  music: "./assets/knowledge/music.md",
  visuals: "./assets/knowledge/visuals.md",
  video: "./assets/knowledge/video.md",
  tools: "./assets/knowledge/tools.md",
  stories: "./assets/knowledge/stories.md",
};

const knowledgeCache = new Map(); // key -> text

async function loadKnowledge(keys) {
  const out = [];
  for (const k of keys) {
    if (!KNOWLEDGE[k]) continue;

    if (!knowledgeCache.has(k)) {
      const res = await fetch(KNOWLEDGE[k], { cache: "force-cache" });
      if (!res.ok) throw new Error(`Knowledge fetch failed (${k}): ${res.status}`);
      const txt = await res.text();
      knowledgeCache.set(k, txt);
    }

    out.push({ key: k, text: knowledgeCache.get(k) });
  }
  return out;
}

/* =========================
   2) Router (pick sources)
   ========================= */
const ROUTER_SYSTEM = `
Du bist ein Router. Du wählst passende Wissensquellen für eine Frage.
Gib ausschließlich gültiges JSON zurück:
{"sources":["music","faq"]}

Erlaubte sources:
about, faq, licensing, music, visuals, video, tools, stories

Regeln:
- Wähle 1-3 sources.
- Wenn unklar: ["faq"].
- Keine Erklärtexte, nur JSON.
`.trim();

// Engine wird erst nach Start initialisiert:
let engine = null;

async function pickSources(question) {
  const ruleFallback = () => {
    const q = (question || "").toLowerCase();
    if (q.includes("lizenz") || q.includes("cc") || q.includes("by-nc-sa")) return ["licensing", "faq"];
    if (q.includes("musik") || q.includes("audio") || q.includes("riffusion") || q.includes("soundcloud")) return ["music", "faq"];
    if (q.includes("bild") || q.includes("visual") || q.includes("cover")) return ["visuals", "faq"];
    if (q.includes("video") || q.includes("sora")) return ["video", "faq"];
    if (q.includes("tool") || q.includes("app") || q.includes("game") || q.includes("waste")) return ["tools", "faq"];
    if (q.includes("story") || q.includes("hörbuch") || q.includes("welt")) return ["stories", "faq"];
    if (q.includes("wer bist du") || q.includes("promptrebel")) return ["about", "faq"];
    return ["faq"];
  };

  // Wenn Engine nicht da ist: nur Regeln
  if (!engine) return ruleFallback();

  try {
    const r = await engine.chat.completions.create({
      messages: [
        { role: "system", content: ROUTER_SYSTEM },
        { role: "user", content: question },
      ],
      temperature: 0,
      stream: false,
      max_tokens: 60,
    });

    const raw = r?.choices?.[0]?.message?.content?.trim() || "";
    const json = JSON.parse(raw);
    const sources = Array.isArray(json.sources) ? json.sources : ruleFallback();

    const cleaned = sources.filter((s) => KNOWLEDGE[s]).slice(0, 3);
    return cleaned.length ? cleaned : ruleFallback();
  } catch {
    return ruleFallback();
  }
}

/* =========================
   3) Config
   ========================= */
const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

/* =========================
   4) UI + CSS
   ========================= */
function injectCSS() {
  const style = document.createElement("style");
  style.textContent = `
  .pr-ai-btn{
    position:fixed; right:16px; bottom:16px; z-index:9999;
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
    position:fixed; right:16px; bottom:68px; z-index:9999;
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

  .pr-ai-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .pr-ai-action{
    border-radius:999px; padding:8px 10px;
    border:1px solid rgba(148,163,184,.22);
    background:rgba(15,23,42,.65);
    color:#e5e7eb; font:700 12px/1 system-ui;
    cursor:pointer;
  }
  .pr-ai-progress{ font:12px/1.35 system-ui; color:#94a3b8; }

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
  .pr-ai-msgs::-webkit-scrollbar{ width:6px; }
  .pr-ai-msgs::-webkit-scrollbar-thumb{
    background: rgba(148,163,184,.25);
    border-radius: 6px;
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
  .pr-ai-send{
    border-radius:999px; padding:10px 12px;
    border:1px solid rgba(34,211,238,.35);
    background:rgba(15,23,42,.75);
    color:#e5e7eb; font:800 13px/1 system-ui;
    cursor:pointer;
  }
  `;
  document.head.appendChild(style);
}

function hasWebGPU() {
  return !!navigator.gpu;
}

/* =========================
   5) App State
   ========================= */
let ready = false;
let greeted = false;
const messages = []; // user/assistant history only (keine system messages)

// System prompt (global)
const SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI", ein lokaler Assistent für die Website PromptRebel.
Du antwortest kurz, konkret und faktenbasiert.
Wenn du etwas nicht aus dem bereitgestellten Wissen ableiten kannst, sag offen, dass du es nicht weißt.

Kontext (allgemein):
- PromptRebel ist ein persönliches KI-Labor (Musik, Visuals, Video, Tools, Stories).
- Inhalte sind experimentell, oft als Prototyp/Work-in-progress.
- Lizenz: CC BY-NC-SA 4.0 (nicht-kommerziell, Namensnennung, ShareAlike).
`.trim();

/* =========================
   6) Bootstrap UI
   ========================= */
function initWidget() {
  injectCSS();

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
        <b>Experiment:</b> Läuft lokal im Browser via <b>WebGPU</b>.
        Beim ersten Start wird ein Modell geladen (100MB+ möglich).
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
    if (!hasWebGPU()) {
      progressEl.textContent =
        "WebGPU nicht verfügbar (auf iPhone/iOS oft deaktiviert). Nutze Desktop (Chrome/Edge) oder Safari mit WebGPU.";
      return;
    }
    if (ready) return;

    progressEl.textContent = "Initialisiere…";
    engine = new MLCEngine({ initProgressCallback });

    try {
      await engine.reload(DEFAULT_MODEL);
      ready = true;
      progressEl.textContent = "Bereit.";

      // Chat sauber initialisieren
      messages.length = 0;
      msgsEl.innerHTML = "";
      greeted = false;

      if (!greeted) {
        addBubble("Hi! Frag mich etwas zu PromptRebel (Wissen wird dynamisch geladen).", "ai");
        greeted = true;
      }
    } catch (e) {
      console.error(e);
      progressEl.textContent = "Fehler beim Laden des Modells. (Browser/WebGPU/Download prüfen)";
    }
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    if (!ready) {
      addBubble("Model ist noch nicht geladen. Klicke zuerst auf „Start (Model laden)“.", "ai");
      return;
    }

    inputEl.value = "";
    addBubble(text, "user");
    messages.push({ role: "user", content: text });

    const aiBubble = document.createElement("div");
    aiBubble.className = "pr-ai-bubble ai";
    aiBubble.textContent = "";
    msgsEl.appendChild(aiBubble);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      // 1) Quellen bestimmen
      const sources = await pickSources(text);

      // 2) Wissen laden
      const docs = await loadKnowledge(sources);

      // 3) Kontext bauen
      const knowledgeContext = docs
        .map((d) => `### ${d.key.toUpperCase()}\n${d.text}`)
        .join("\n\n");

      // 4) System + Wissen + History
      const scopedMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content:
            "Nutze ausschließlich das folgende Wissen zur Beantwortung. " +
            "Wenn etwas nicht enthalten ist, sage offen, dass du es nicht weißt.\n\n" +
            knowledgeContext,
        },
        ...messages,
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

      messages.push({ role: "assistant", content: reply || "(keine Ausgabe)" });
    } catch (e) {
      console.error(e);
      aiBubble.textContent = "Fehler beim Antworten. (Konsole prüfen)";
    }
  }

  // UI wiring
  btn.addEventListener("click", () => panel.classList.toggle("open"));
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  panel.querySelectorAll("[data-action]").forEach((b) => {
    b.addEventListener("click", async () => {
      const action = b.getAttribute("data-action");
      if (action === "start") await startModel();
      if (action === "clear") {
        msgsEl.innerHTML = "";
        progressEl.textContent = ready ? "Bereit." : "";
        messages.length = 0;
        greeted = false;
        if (ready && !greeted) {
          addBubble("Hi! Frag mich etwas zu PromptRebel (Wissen wird dynamisch geladen).", "ai");
          greeted = true;
        }
      }
    });
  });

  sendEl.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}

// Robust init (falls Script mal im Head landet)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidget);
} else {
  initWidget();
}
