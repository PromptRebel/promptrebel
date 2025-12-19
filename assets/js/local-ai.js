// PromptRebel Local-AI Widget (WebLLM / WebGPU)
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

/* =========================
   Knowledge Index
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

const knowledgeCache = new Map();

async function loadKnowledge(keys) {
  const docs = [];
  for (const k of keys) {
    if (!KNOWLEDGE[k]) continue;
    if (!knowledgeCache.has(k)) {
      const res = await fetch(KNOWLEDGE[k]);
      knowledgeCache.set(k, await res.text());
    }
    docs.push({ key: k, text: knowledgeCache.get(k) });
  }
  return docs;
}

/* =========================
   Router
========================= */
const ROUTER_SYSTEM = `
Du bist ein Router.
Gib ausschließlich gültiges JSON zurück:
{"sources":["music","faq"]}

Erlaubte sources:
about, faq, licensing, music, visuals, video, tools, stories

Regeln:
- Wähle 1–3 sources
- Wenn unklar: ["faq"]
- Keine Erklärungen
`.trim();

async function pickSources(question) {
  const fallback = () => {
    const q = question.toLowerCase();
    if (q.includes("lizenz")) return ["licensing","faq"];
    if (q.includes("musik")) return ["music","faq"];
    if (q.includes("video")) return ["video","faq"];
    if (q.includes("tool")) return ["tools","faq"];
    if (q.includes("story")) return ["stories","faq"];
    if (q.includes("promptrebel")) return ["about","faq"];
    return ["faq"];
  };

  try {
    const r = await engine.chat.completions.create({
      messages: [
        { role: "system", content: ROUTER_SYSTEM },
        { role: "user", content: question }
      ],
      temperature: 0,
      stream: false,
    });

    const parsed = JSON.parse(r.choices[0].message.content);
    return parsed.sources.filter(s => KNOWLEDGE[s]).slice(0,3);
  } catch {
    return fallback();
  }
}

/* =========================
   Engine State
========================= */
let engine = null;
let ready = false;
const messages = [];

const SYSTEM_PROMPT = `
Du bist "PromptRebel Local AI".
Antworte kurz, ehrlich und faktenbasiert.
Wenn Wissen fehlt: sag es offen.
`.trim();

/* =========================
   UI Setup (gekürzt)
========================= */
const btn = document.createElement("button");
btn.textContent = "Local AI";
btn.style.position = "fixed";
btn.style.bottom = "16px";
btn.style.right = "16px";
btn.style.zIndex = "9999";
document.body.appendChild(btn);

const panel = document.createElement("div");
panel.style.display = "none";
panel.style.position = "fixed";
panel.style.bottom = "64px";
panel.style.right = "16px";
panel.style.width = "380px";
panel.style.height = "600px";
panel.style.background = "#020617";
panel.style.color = "#fff";
panel.style.padding = "12px";
panel.style.borderRadius = "16px";
panel.style.overflow = "hidden";
document.body.appendChild(panel);

panel.innerHTML = `
  <button id="startBtn">Start (Model laden)</button>
  <div id="msgs" style="height:440px;overflow:auto;margin:10px 0"></div>
  <input id="input" placeholder="Frage zu PromptRebel…" />
  <button id="send">Send</button>
`;

btn.onclick = () => panel.style.display = panel.style.display === "none" ? "block" : "none";

const msgsEl = panel.querySelector("#msgs");
const inputEl = panel.querySelector("#input");

/* =========================
   Start Model
========================= */
panel.querySelector("#startBtn").onclick = async () => {
  engine = new MLCEngine();
  await engine.reload("Llama-3.2-1B-Instruct-q4f16_1-MLC");
  ready = true;
  msgsEl.innerHTML += `<div>✅ Bereit. Wissen wird dynamisch geladen.</div>`;
};

/* =========================
   Send Message (EINZIGE!)
========================= */
panel.querySelector("#send").onclick = async () => {
  const text = inputEl.value.trim();
  if (!text || !ready) return;

  msgsEl.innerHTML += `<div><b>Du:</b> ${text}</div>`;
  inputEl.value = "";

  try {
    const sources = await pickSources(text);
    const docs = await loadKnowledge(sources);

    const knowledgeContext = docs.map(d =>
      `### ${d.key.toUpperCase()}\n${d.text}`
    ).join("\n\n");

    const scopedMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: knowledgeContext },
      ...messages,
      { role: "user", content: text }
    ];

    const r = await engine.chat.completions.create({
      messages: scopedMessages,
      temperature: 0.2,
      stream: false,
    });

    const reply = r.choices[0].message.content;
    msgsEl.innerHTML += `<div><b>AI:</b> ${reply}</div>`;
    messages.push({ role: "assistant", content: reply });

  } catch (e) {
    console.error(e);
    msgsEl.innerHTML += `<div>❌ Fehler beim Antworten (Konsole prüfen)</div>`;
  }
};
