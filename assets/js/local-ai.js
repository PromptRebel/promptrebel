// assets/js/local-ai.js
// PromptRebel Local-AI Widget (WebLLM / WebGPU) – STABLE FIRST
// Model: Qwen2-0.5B-Instruct-q4f16_1-MLC
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

// ---- Guard: prevent double init (double script tag / navigation) ----
if (window.__PROMPTREBEL_LOCAL_AI__) {
  // already initialized
} else {
  window.__PROMPTREBEL_LOCAL_AI__ = true;

  // ========= Config =========
  const DEFAULT_MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

  // Answer behavior
  const TEMPERATURE = 0.0;         // deterministic
  const MAX_TOKENS = 260;          // allow decent answers
  const MAX_QA_CONTEXT = 3;        // inject only top 1–3 QAs
  const HISTORY_MAX_MSGS = 2;      // keep minimal history: current user + current assistant

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
  };

  // ========= Caches =========
  const fileTextCache = new Map();    // key -> raw markdown
  const qaCache = new Map();          // key -> parsed QAs [{q,a}]
  const normQCache = new Map();       // key -> normalized question tokens cache (optional)

  // ========= Helpers =========
  function hasWebGPU() { return !!navigator.gpu; }

  function clampHistory(history) {
    while (history.length > HISTORY_MAX_MSGS) history.shift();
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function normalizeText(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(s) {
    const t = normalizeText(s);
    if (!t) return [];
    const raw = t.split(" ");
    // keep tokens >= 3 chars, but allow "cc"
    return raw.filter(w => w.length >= 3 || w === "cc");
  }

  function scoreOverlap(queryTokens, candidateTokens) {
    if (!queryTokens.length || !candidateTokens.length) return 0;

    const set = new Set(candidateTokens);
    let hit = 0;
    for (const w of queryTokens) if (set.has(w)) hit++;

    // small bonus if important keywords present
    const q = queryTokens.join(" ");
    let bonus = 0;
    if (q.includes("lizenz") || q.includes("license") || q.includes("by-nc-sa") || q.includes("cc")) bonus += 1.2;
    if (q.includes("iphone") || q.includes("ios") || q.includes("webgpu")) bonus += 0.8;

    return (hit / Math.max(3, queryTokens.length)) + bonus;
  }

  // ========= Fetch + Parse Q&A =========
  async function loadFileText(key) {
    if (!KNOWLEDGE[key]) return "";
    if (fileTextCache.has(key)) return fileTextCache.get(key);

    const res = await fetch(KNOWLEDGE[key], { cache: "force-cache" });
    if (!res.ok) throw new Error(`Knowledge fetch failed: ${key} (${res.status})`);
    const txt = ((await res.text()) || "").trim();
    fileTextCache.set(key, txt);
    return txt;
  }

  // Parse markdown:
  // - find "## Question" headings
  // - answer is text until next "## " heading (or EOF)
  function parseMarkdownToQA(md) {
    const lines = (md || "").split(/\r?\n/);
    const qa = [];
    let currentQ = null;
    let buf = [];

    const flush = () => {
      const a = buf.join("\n").trim();
      if (currentQ && a) qa.push({ q: currentQ.trim(), a });
      currentQ = null;
      buf = [];
    };

    for (const line of lines) {
      const m = line.match(/^##\s+(.*)\s*$/);
      if (m) {
        flush();
        currentQ = m[1];
        continue;
      }
      if (currentQ) buf.push(line);
    }
    flush();

    return qa;
  }

  async function loadQAs(keys) {
    const all = [];
    for (const k of keys) {
      if (!KNOWLEDGE[k]) continue;
      if (!qaCache.has(k)) {
        const md = await loadFileText(k);
        qaCache.set(k, parseMarkdownToQA(md));
      }
      const qas = qaCache.get(k) || [];
      for (const item of qas) {
        all.push({ ...item, file: k });
      }
    }
    return all;
  }

  function pickSourcesHeuristic(question) {
    const q = (question || "").toLowerCase();

    if (q.includes("lizenz") || q.includes("license") || q.includes("cc") || q.includes("by-nc-sa")) return ["licensing", "faq"];
    if (q.includes("iphone") || q.includes("ios") || q.includes("webgpu")) return ["faq"];
    if (q.includes("musik") || q.includes("audio") || q.includes("riffusion") || q.includes("soundcloud")) return ["music", "faq"];
    if (q.includes("bild") || q.includes("visual") || q.includes("cover")) return ["visuals", "faq"];
    if (q.includes("video") || q.includes("sora")) return ["video", "faq"];
    if (q.includes("tool") || q.includes("app") || q.includes("game") || q.includes("waste")) return ["tools", "faq"];
    if (q.includes("story") || q.includes("hörbuch") || q.includes("welt")) return ["stories", "faq"];
    if (q.includes("wer bist du") || q.includes("promptrebel") || q.includes("was ist")) return ["about", "faq"];

    return ["faq"];
  }

  function selectBestQAs(allQAs, userQuestion, limit = 3) {
    const qTokens = tokenize(userQuestion);
    const scored = allQAs.map(item => {
      // cache candidate tokens per file+question if you like (not required)
      const candTokens = tokenize(item.q);
      const s = scoreOverlap(qTokens, candTokens);
      return { ...item, score: s };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored.filter(x => x.score > 0.2).slice(0, limit); // threshold avoids garbage matches
    return best;
  }

  // ========= Prompt =========
  const SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI" (läuft lokal im Browser).

WICHTIG:
- Antworte NUR anhand der Q&A im KONTEXT.
- Wenn keine passende Q&A vorhanden ist: antworte exakt "Ich weiß es nicht." (ohne Zusatz).
- Keine Vermutungen, keine erfundenen Fakten.
- Antworte kurz und konkret (1–4 Sätze).
- Wenn möglich: ergänze am Ende in Klammern die Datei, z.B. "(faq.md)" oder "(licensing.md)".
`.trim();

  function buildContextFromQAs(qas) {
    if (!qas.length) return "";
    const chunks = qas.map(x =>
      `Q: ${x.q}\nA: ${x.a}\nSOURCE: ${x.file}.md`
    );
    return chunks.join("\n\n---\n\n");
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
  let busy = false;
  const chatHistory = [];

  // ========= UI =========
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
        <div>PromptRebel Local AI <small>· Modell: Qwen2-0.5B (WebGPU)</small></div>
        <button class="pr-ai-x" type="button" aria-label="Close">×</button>
      </div>
      <div class="pr-ai-body">
        <div class="pr-ai-note">
          <b>Stabiler Modus:</b> Antworten basieren nur auf passenden Q&A aus den MD-Dateien.
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

        addBubble("Hi! Stell mir eine Frage – ich nutze nur passende Q&A aus den MD-Dateien.", "ai");
      } catch (e) {
        console.error(e);
        ready = false;
        engine = null;
        const msg = String(e?.message || e || "");
        progressEl.textContent = msg.toLowerCase().includes("disposed")
          ? "WebGPU/Engine wurde zurückgesetzt (disposed). Bitte Seite neu laden und erneut Start klicken."
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
      const aiBubble = addBubble("Denke nach…", "ai");

      try {
        // Minimal history
        chatHistory.push({ role: "user", content: text });
        clampHistory(chatHistory);

        // 1) choose sources (cheap heuristic)
        const sources = pickSourcesHeuristic(text);

        // 2) load + parse QAs from those sources
        aiBubble.textContent = "Suche passende Q&A…";
        const allQAs = await loadQAs(sources);

        // If no QAs parsed at all -> hard fail to "Ich weiß es nicht."
        if (!allQAs.length) {
          aiBubble.textContent = "Ich weiß es nicht.";
          chatHistory.push({ role: "assistant", content: aiBubble.textContent });
          clampHistory(chatHistory);
          return;
        }

        // 3) select best matches
        const best = selectBestQAs(allQAs, text, MAX_QA_CONTEXT);

        if (!best.length) {
          aiBubble.textContent = "Ich weiß es nicht.";
          chatHistory.push({ role: "assistant", content: aiBubble.textContent });
          clampHistory(chatHistory);
          return;
        }

        // 4) Build tight context ONLY from best QAs
        const context = buildContextFromQAs(best);

        // 5) Ask model with strict system prompt
        const messages = [
          { role: "system", content: `${SYSTEM_PROMPT}\n\nKONTEXT (Q&A):\n${context}` },
          ...chatHistory
        ];

        // Small cooldown helps on some Windows/WebGPU setups
        await sleep(30);

        const chunks = await engine.chat.completions.create({
          messages,
          temperature: TEMPERATURE,
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

        const final = (reply || "").trim() || "Ich weiß es nicht.";
        aiBubble.textContent = final;

        chatHistory.push({ role: "assistant", content: final });
        clampHistory(chatHistory);
      } catch (e) {
        console.error(e);
        const msg = String(e?.message || e || "");
        if (msg.toLowerCase().includes("disposed") || msg.toLowerCase().includes("device was lost")) {
          aiBubble.textContent = "WebGPU wurde zurückgesetzt. Bitte Seite neu laden und Modell erneut starten.";
          ready = false;
          engine = null;
          progressEl.textContent = "Engine nicht bereit.";
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
