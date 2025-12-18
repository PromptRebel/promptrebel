
  // PromptRebel Local-AI Widget (WebLLM / WebGPU)
  // Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

  import { MLCEngine, prebuiltAppConfig } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

  // ========= Config =========
  const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC"; // klein & schnell(er)
  // Model-Liste (falls du später wechseln willst): prebuiltAppConfig.model_list
  // Verfügbare Modelle: https://mlc.ai/models (und GitHub issue list)
  // ==========================

  // --- Minimal CSS injected once ---
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
    .pr-ai-btn:hover{ border-color: rgba(34,211,238,.8); box-shadow:0 0 18px rgba(34,211,238,.35), 0 10px 30px rgba(2,6,23,.7); }

    .pr-ai-panel{
      position:fixed; right:16px; bottom:68px; z-index:9999;
      width:min(380px, calc(100vw - 32px));
      height:min(520px, calc(100vh - 120px));
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

    .pr-ai-body{ display:flex; flex-direction:column; gap:10px; padding:12px; height:100%; }
    .pr-ai-msgs{
      flex:1; overflow:auto; padding-right:4px;
      display:flex; flex-direction:column; gap:10px;
      font: 13px/1.45 system-ui; color:#e5e7eb;
    }
    .pr-ai-bubble{
      max-width:92%; padding:10px 12px; border-radius:14px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(15,23,42,.7);
      white-space:pre-wrap;
    }
    .pr-ai-bubble.user{ align-self:flex-end; border-color: rgba(34,211,238,.22); }
    .pr-ai-bubble.ai{ align-self:flex-start; border-color: rgba(236,72,153,.22); }

    .pr-ai-row{ display:flex; gap:8px; }
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
    .pr-ai-note{
      font: 12px/1.35 system-ui; color:#94a3b8;
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
  `;
  document.head.appendChild(style);

  // --- UI elements ---
  const btn = document.createElement("button");
  btn.className = "pr-ai-btn";
  btn.type = "button";
  btn.textContent = "Local AI";

  const panel = document.createElement("div");
  panel.className = "pr-ai-panel";
  panel.innerHTML = `
    <div class="pr-ai-top">
      <div>
        PromptRebel Local AI <small>· läuft lokal (WebGPU)</small>
      </div>
      <button class="pr-ai-x" type="button">×</button>
    </div>
    <div class="pr-ai-body">
      <div class="pr-ai-note">
        <b>Experiment:</b> Dieses Chat-Modell läuft <b>lokal im Browser</b> und nutzt (wenn verfügbar) <b>WebGPU</b>.
        Beim ersten Start wird ein Modell heruntergeladen (kann je nach Modell mehrere 100MB+ sein).
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

  // --- WebGPU capability check (best-effort) ---
  function hasWebGPU() {
    return !!navigator.gpu;
  }

  // --- Engine / state ---
  let engine = null;
  let ready = false;
  const messages = [];

  // Your "PromptRebel knowledge" as SYSTEM prompt (keep it compact)
  // Tipp: lieber kurze, klare Wissensblöcke + Links/Seitenhinweise statt riesige Texte.
  const SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI", ein lokaler Assistent für die Website PromptRebel.
Du beantwortest Fragen kurz, konkret und faktenbasiert. Wenn du etwas nicht weißt, sag es offen.
Kontext:
- PromptRebel ist ein persönliches KI-Labor (Musik, Visuals, Video, Tools, Stories).
- Inhalte sind experimentell, oft als Prototyp/Work-in-progress.
- Lizenz: CC BY-NC-SA 4.0 (nicht-kommerziell, Namensnennung, Weitergabe unter gleichen Bedingungen).
Aufgabe:
- Erkläre Navigation, Inhalte, Prompts/Workflows auf der Seite.
- Gib praktische Hinweise (z.B. Prompt-Anpassung), aber keine sensiblen Daten erfinden.
`.trim();

  function initProgressCallback(p) {
    // p enthält text/percentage je nach Version; defensiv anzeigen:
    const msg = typeof p === "string" ? p : JSON.stringify(p);
    progressEl.textContent = `Loading: ${msg}`;
  }

  async function startModel() {
    if (!hasWebGPU()) {
      progressEl.textContent =
        "WebGPU nicht verfügbar. Auf iPhone/iOS kann WebGPU je nach Version/Feature-Flag fehlen. Nutze Desktop (Chrome/Edge) oder Safari mit WebGPU aktiviert.";
      return;
    }
    if (ready) return;

    progressEl.textContent = "Initialisiere…";
    engine = new MLCEngine({ initProgressCallback });

    // Optional: prüfen, ob das Modell in der prebuilt list existiert
    const exists = prebuiltAppConfig.model_list?.some((m) => m.model_id === DEFAULT_MODEL || m.model === DEFAULT_MODEL);
    // (Nicht kritisch – reload wirft Fehler, wenn unauffindbar)
    try {
      await engine.reload(DEFAULT_MODEL);
      ready = true;
      progressEl.textContent = "Bereit.";
      messages.length = 0;
      messages.push({ role: "system", content: SYSTEM_PROMPT });
      addBubble("Hi! Ich laufe lokal im Browser. Frag mich etwas zu PromptRebel.", "ai");
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

    // Streaming-Ausgabe (wir bauen den AI-Text live zusammen)
    const aiBubble = document.createElement("div");
    aiBubble.className = "pr-ai-bubble ai";
    aiBubble.textContent = "";
    msgsEl.appendChild(aiBubble);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const chunks = await engine.chat.completions.create({
        messages,
        temperature: 0.2,
        stream: true,
        stream_options: { include_usage: true },
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

      // final message in engine + store in our history
      const full = await engine.getMessage();
      messages.push({ role: "assistant", content: full });

      // Optional: usage anzeigen
      // (Tokens sind hier nur Kontext-/Antwortlänge, nicht "Kosten")
    } catch (e) {
      console.error(e);
      aiBubble.textContent = "Fehler beim Antworten (WebGPU/Model/Memory).";
    }
  }

  // --- UI wiring ---
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
        if (ready) messages.push({ role: "system", content: SYSTEM_PROMPT });
      }
    });
  });

  sendEl.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

