// PromptRebel Local-AI Widget (WebLLM / WebGPU)
// Step A: classify (no stream, temp 0)
// Step B: answer (stream)
// Single-flight lock + dynamic knowledge loading + chatHistory limit

// ---- Guard: prevent double init (double script tag / navigation) ----
if (window.__PROMPTREBEL_LOCAL_AI__) {
  // already initialized
} else {
  window.__PROMPTREBEL_LOCAL_AI__ = true;

  (async () => {
    // IMPORTANT: In ES modules, "import" must be top-level.
    // So we use dynamic import here to avoid breaking execution flow.
    const { MLCEngine, prebuiltAppConfig } = await import(
      "https://esm.run/@mlc-ai/web-llm@0.2.80"
    );

    // ========= Config =========
    const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    const HISTORY_MAX_TURNS = 6; // optional stability: last N user/assistant messages

    // ========= System prompt =========
    const SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI", ein lokaler Assistent für die Website PromptRebel.
Du antwortest faktenbasiert, freundlich und klar. Wenn etwas nicht im Wissenskontext steht: sag offen "Ich weiß es nicht" und frage ggf. nach.

Rahmen:
- PromptRebel ist ein persönliches KI-Labor (Musik, Visuals, Video, Tools, Stories).
- Inhalte sind experimentell / Work-in-progress.
- Lizenz: CC BY-NC-SA 4.0 (nicht-kommerziell, Namensnennung, Weitergabe unter gleichen Bedingungen).

Antwortstil:
- 2 bis 4 Sätze, keine Romane.
- Keine ausgedachten Fakten.
`.trim();

    // ========= Knowledge index (robust paths) =========
    // local-ai.js is at: /assets/js/local-ai.js
    // knowledge is at: /assets/knowledge/*.md
    const KNOWLEDGE = {
      about: new URL("../knowledge/about.md", import.meta.url).href,
      faq: new URL("../knowledge/faq.md", import.meta.url).href,
      licensing: new URL("../knowledge/licensing.md", import.meta.url).href,
      music: new URL("../knowledge/music.md", import.meta.url).href,
      visuals: new URL("../knowledge/visuals.md", import.meta.url).href,
      video: new URL("../knowledge/video.md", import.meta.url).href,
      tools: new URL("../knowledge/tools.md", import.meta.url).href,
      stories: new URL("../knowledge/stories.md", import.meta.url).href,
    };

    const knowledgeCache = new Map(); // key -> md text

    async function loadKnowledge(keys) {
      const out = [];
      for (const k of keys) {
        if (!KNOWLEDGE[k]) continue;

        if (!knowledgeCache.has(k)) {
          const res = await fetch(KNOWLEDGE[k], { cache: "force-cache" });
          if (!res.ok) throw new Error(`Knowledge fetch failed: ${k} (${res.status})`);
          const txt = await res.text();
          knowledgeCache.set(k, txt);
        }
        out.push({ key: k, text: knowledgeCache.get(k) });
      }
      return out;
    }

    // ========= Router prompt =========
    const ROUTER_SYSTEM = `
Du klassifizierst eine Nutzerfrage und wählst passende Wissensquellen.
Gib AUSSCHLIESSLICH JSON zurück, kein Markdown, kein Text außenrum.

Format:
{"sources":["licensing","faq"]}

Erlaubte sources:
about, faq, licensing, music, visuals, video, tools, stories

Regeln:
- Wähle 1 bis 3 sources.
- Wenn unklar: ["faq"].
`.trim();

    function ruleFallback(question) {
      const q = (question || "").toLowerCase();
      if (q.includes("lizenz") || q.includes("cc") || q.includes("by-nc-sa")) return ["licensing", "faq"];
      if (q.includes("musik") || q.includes("audio") || q.includes("riffusion") || q.includes("soundcloud")) return ["music", "faq"];
      if (q.includes("bild") || q.includes("visual") || q.includes("cover")) return ["visuals", "faq"];
      if (q.includes("video") || q.includes("sora")) return ["video", "faq"];
      if (q.includes("tool") || q.includes("app") || q.includes("game") || q.includes("waste")) return ["tools", "faq"];
      if (q.includes("story") || q.includes("hörbuch") || q.includes("welt")) return ["stories", "faq"];
      if (q.includes("wer bist du") || q.includes("promptrebel") || q.includes("was ist promptrebel")) return ["about", "faq"];
      return ["faq"];
    }

    function safeParseRouterJSON(raw) {
      if (!raw) return null;
      const t = raw.trim();
      try { return JSON.parse(t); } catch {}
      const m = t.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch {}
      return null;
    }

    // ========= WebGPU =========
    function hasWebGPU() {
      return !!navigator.gpu;
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
      .pr-ai-x[disabled]{ opacity:.45; cursor:not-allowed; }

      .pr-ai-body{
        display:flex; flex-direction:column;
        gap:10px; padding:12px;
        height:100%; min-height:0;
      }

      .pr-ai-note{
        font:12px/1.35 system-ui; color:#94a3b8;
        border:1px solid rgba(148,163,184,.14);
        background:rgba(15,23,42,.55);
        padding:10px 12px; border-radius:14px;
      }
      .pr-ai-progress{ font:12px/1.35 system-ui; color:#94a3b8; min-height:16px; }

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
        padding:12px;
        padding-bottom:96px;
        display:flex; flex-direction:column;
        gap:10px;
        font:13px/1.45 system-ui; color:#e5e7eb;
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

    // ========= DOM init =========
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
      const startBtn = panel.querySelector('[data-action="start"]');
      const clearBtn = panel.querySelector('[data-action="clear"]');
      const progressEl = panel.querySelector("#prAiProgress");
      const msgsEl = panel.querySelector("#prAiMsgs");
      const inputEl = panel.querySelector("#prAiInput");
      const sendEl = panel.querySelector("#prAiSend");

      // ========= Engine/state =========
      let engine = null;
      let ready = false;
      let busy = false;      // single-flight lock (A+B)
      let starting = false;  // start lock
      const chatHistory = []; // user/assistant turns only

      function addBubble(text, who) {
        const d = document.createElement("div");
        d.className = `pr-ai-bubble ${who}`;
        d.textContent = text;
        msgsEl.appendChild(d);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return d;
      }

      function setBusy(on) {
        busy = on;

        // disable send + input + close while busy
        sendEl.disabled = on;
        inputEl.disabled = on;

        // close button: disabled while busy
        closeBtn.disabled = on;

        // also disable start while busy/ready
        startBtn.disabled = on || ready || starting;
        clearBtn.disabled = on;

        // prevent panel closing while busy: also block toggle
        btn.disabled = false; // button can still open panel
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
            "WebGPU nicht verfügbar. Auf iPhone/iOS ist das oft (noch) nicht nutzbar. Nutze Desktop (Chrome/Edge) oder Safari mit WebGPU aktiviert.";
          return;
        }

        starting = true;
        startBtn.disabled = true;
        progressEl.textContent = "Initialisiere…";

        try {
          engine = new MLCEngine({ initProgressCallback });

          // existence check is optional (no throw)
          prebuiltAppConfig.model_list?.some(
            (m) => m.model_id === DEFAULT_MODEL || m.model === DEFAULT_MODEL
          );

          await engine.reload(DEFAULT_MODEL);

          ready = true;
          progressEl.textContent = "Bereit.";
          msgsEl.innerHTML = "";
          chatHistory.length = 0;

          addBubble("Hi! Stell mir eine Frage – ich lade das passende Wissen dynamisch.", "ai");
          setBusy(false);
        } catch (e) {
          console.error(e);
          progressEl.textContent = "Fehler beim Laden des Modells. (Konsole prüfen)";
          ready = false;
          engine = null;
        } finally {
          starting = false;
          startBtn.disabled = ready || busy || starting;
        }
      }

      async function classifySources(question) {
        // Step A: no stream, temp 0
        if (!engine || !ready) return ruleFallback(question);

        try {
          const r = await engine.chat.completions.create({
            messages: [
              { role: "system", content: ROUTER_SYSTEM },
              { role: "user", content: question },
            ],
            temperature: 0,
            stream: false,
          });

          const raw = r?.choices?.[0]?.message?.content?.trim() || "";
          const json = safeParseRouterJSON(raw);

          const sources = Array.isArray(json?.sources) ? json.sources : ruleFallback(question);
          const allowed = new Set(Object.keys(KNOWLEDGE));
          const cleaned = sources.filter((s) => allowed.has(s)).slice(0, 3);
          return cleaned.length ? cleaned : ruleFallback(question);
        } catch (e) {
          console.warn("Router failed, fallback used:", e);
          return ruleFallback(question);
        }
      }

      async function answerWithKnowledge(aiBubble) {
        // Build combined system prompt (more reliable than 2 system msgs)
        const knowledgeContext = (aiBubble.__docs || [])
          .map((d) => `### ${d.key.toUpperCase()}\n${d.text}`)
          .join("\n\n");

        const combinedSystem =
          `${SYSTEM_PROMPT}\n\n` +
          `WISSENSKONTEXT (nutze nur das, erfinde nichts):\n${knowledgeContext}`;

        const scopedMessages = [
          { role: "system", content: combinedSystem },
          ...chatHistory,
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

        return reply.trim();
      }

      async function sendMessage() {
        if (busy) return;

        const text = inputEl.value.trim();
        if (!text) return;

        if (!ready || !engine) {
          addBubble("Model ist noch nicht geladen. Klicke zuerst auf „Start (Model laden)“.", "ai");
          return;
        }

        setBusy(true);
        progressEl.textContent = "";

        inputEl.value = "";
        addBubble(text, "user");

        // Add to history immediately (so Step B includes the current question)
        chatHistory.push({ role: "user", content: text });

        // limit history (optional stability)
        // keep last N turns (user+assistant => 2 per turn approx)
        const maxMsgs = HISTORY_MAX_TURNS * 2;
        if (chatHistory.length > maxMsgs) {
          chatHistory.splice(0, chatHistory.length - maxMsgs);
        }

        // Create one AI bubble that changes: "denke nach..." -> "suche Wissen..." -> answer
        const aiBubble = addBubble("Denke nach…", "ai");

        try {
          // Step A: classify
          const sources = await classifySources(text);
          aiBubble.textContent = "Suche Wissen…";

          // Give WebGPU a tiny cooldown between A and B (helps stability)
          await new Promise((r) => setTimeout(r, 80));

          // Load docs
          const docs = await loadKnowledge(sources);
          aiBubble.__docs = docs;

          // Step B: answer (stream)
          const reply = await answerWithKnowledge(aiBubble);

          // store assistant reply
          chatHistory.push({ role: "assistant", content: reply || "Ich weiß es nicht." });

          // limit again
          if (chatHistory.length > maxMsgs) {
            chatHistory.splice(0, chatHistory.length - maxMsgs);
          }
        } catch (e) {
          console.error(e);

          const msg = String(e?.message || e);
          if (msg.toLowerCase().includes("disposed")) {
            aiBubble.textContent =
              "WebGPU-Ressourcen wurden zurückgesetzt („disposed“). Bitte Seite neu laden und Modell erneut starten.";
            // hard reset engine state so user can recover cleanly
            ready = false;
            engine = null;
            progressEl.textContent = "Engine zurückgesetzt. Bitte „Start“ erneut klicken.";
          } else {
            aiBubble.textContent = "Fehler beim Antworten. (Konsole prüfen)";
          }
        } finally {
          setBusy(false);
          startBtn.disabled = ready || busy || starting;
        }
      }

      // ========= Wiring =========
      btn.addEventListener("click", () => {
        // allow open/close only if not busy
        if (busy) return;
        panel.classList.toggle("open");
      });

      closeBtn.addEventListener("click", () => {
        if (busy) return; // locked while generating
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

      // initial state
      setBusy(false);
      startBtn.disabled = starting || busy;
    }

    // Init after DOM
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initUI, { once: true });
    } else {
      initUI();
    }
  })();
}
