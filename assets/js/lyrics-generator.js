// assets/js/lyrics-generator.js
// PromptRebel Lyrics Generator (WebLLM / WebGPU) – STABLE, SIMPLE
// Model: Qwen2-0.5B-Instruct-q4f16_1-MLC
// Purpose: Generate German lyrics from a soundprompt (single-turn, structured output)
// Docs: https://webllm.mlc.ai/docs/user/basic_usage.html

import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

// ---- Guard: prevent double init ----
if (window.__PROMPTREBEL_LYRICS_GEN__) {
  // already initialized
} else {
  window.__PROMPTREBEL_LYRICS_GEN__ = true;

  // ========= Config =========
  const MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
  const TEMPERATURE = 0.2;     // small creativity but still stable
  const MAX_TOKENS  = 520;     // enough for full lyrics
  const TOP_P       = 0.95;    // sane default

  // ========= System prompt (clean, not overkill) =========
  // Goal: consistent format, German lyrics, no meta talk, no disclaimers.
  const SYSTEM_PROMPT = `
Du bist ein Lyrics-Generator für deutschsprachige Songs.

Aufgabe:
- Erzeuge einen fertigen Songtext basierend auf dem INPUT (Soundprompt + optional Thema/Story).
- Nutze den INPUT als Stil-/Vibe-Leitplanke (Tempo, Stimmung, Genre, Stimme, Attitüde).

Ausgabe-Regeln:
- Gib NUR den Songtext aus. Keine Erklärungen, keine Hinweise, kein "hier ist".
- Verwende dieses Format exakt (Überschriften in eckigen Klammern):
  [INTRO]
  (2–4 kurze Zeilen)
  [VERSE 1]
  (12–16 Zeilen)
  [HOOK]
  (6–8 Zeilen, merkbar, wiederholbar)
  [VERSE 2]
  (12–16 Zeilen)
  [HOOK]
  (6–8 Zeilen)
  [OUTRO]
  (2–4 Zeilen)

Qualität:
- Deutsche Umgangssprache, natürlich, keine gestelzten Reime.
- Bilder + klare Motive; Hook muss den Kern tragen.
- Kein Namedropping realer Personen/Marken.
- Keine Inhalte mit Minderjährigen. Keine Aufrufe zu Gewalt oder illegalen Handlungen.

Wenn der INPUT zu dünn ist:
- Erfinde ein neutrales Thema, das zum Vibe passt (z.B. Kontrolle/Isolation/Neustart/Spiegelbild), ohne es anzukündigen.
`.trim();

  // ========= “Copy Prompt” text (for any KI) =========
  // This is what you show in Card 1. It matches the SYSTEM_PROMPT conceptually.
  const COPY_PROMPT_FOR_ANY_AI = `
Rolle: Du bist ein Lyrics-Generator für deutschsprachige Songs.

INPUT (vom User):
1) SOUND-PROMPT (Genre, Tempo/BPM, Mood, Vocals, Stil)
2) Optional: 1–2 Sätze Thema/Story, Perspektive, Hook-Idee

AUFGABE:
Erzeuge einen fertigen Songtext, der stilistisch exakt zum SOUND-PROMPT passt.

AUSGABE-REGELN (wichtig):
- Gib NUR den Songtext aus (keine Erklärungen).
- Verwende dieses Format exakt:
  [INTRO] (2–4 Zeilen)
  [VERSE 1] (12–16 Zeilen)
  [HOOK] (6–8 Zeilen)
  [VERSE 2] (12–16 Zeilen)
  [HOOK] (6–8 Zeilen)
  [OUTRO] (2–4 Zeilen)
- Deutsche Umgangssprache, klare Bilder, Hook merkbar.
- Keine realen Personennamen/Marken.
- Keine Minderjährigen. Keine Aufrufe zu Gewalt/Illegalem.

USER-INPUT:
<SOUND_PROMPT>
( hier einfügen )
</SOUND_PROMPT>

<OPTIONAL_THEMATIC_HINT>
( optional: Thema/Story/Perspektive )
</OPTIONAL_THEMATIC_HINT>
`.trim();

  // ========= Helpers =========
  function hasWebGPU() { return !!navigator.gpu; }

  function toast(msg) {
    // optional: reuse your existing toast if present
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(window.__prToastTimer);
    window.__prToastTimer = setTimeout(() => el.classList.remove("show"), 1200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied ✓");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Copied ✓");
    }
  }

  function cleanOutput(s) {
    let t = String(s || "").trim();

    // Remove common small-model "prefaces"
    t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    t = t.replace(/^(songtext|lyrics|hier ist|hier sind)\s*[:\-–]\s*/i, "").trim();

    // Ensure it starts with [INTRO] when possible
    if (!t.includes("[INTRO]")) {
      // If model forgot headings, do minimal salvage:
      t = `[INTRO]\n${t}`;
    }
    return t.trim();
  }

  // ========= Engine state =========
  let engine = null;
  let ready = false;
  let starting = false;
  let busy = false;

  // ========= UI wiring =========
  function initLyricsGeneratorUI() {
    // Fill copy prompt text (Card 1)
    const pre = document.getElementById("lyricsPromptText");
    if (pre) pre.textContent = COPY_PROMPT_FOR_ANY_AI;

    const copyPromptBtn = document.getElementById("copyLyricsPromptBtn");
    if (copyPromptBtn) {
      copyPromptBtn.addEventListener("click", () => copyText(COPY_PROMPT_FOR_ANY_AI));
    }

    // Agent link placeholder (Card 2)
    // -> set your real link later:
    // document.getElementById("openLyricsAgentBtn").href = "https://chatgpt.com/g/....";
    const agentBtn = document.getElementById("openLyricsAgentBtn");
    if (agentBtn) {
      agentBtn.addEventListener("click", (e) => {
        const href = agentBtn.getAttribute("href");
        if (!href || href === "#") {
          e.preventDefault();
          toast("Agent-Link fehlt (noch)");
        }
      });
    }

    // WebGPU Generator (Card 3)
    const startBtn = document.getElementById("lgStartBtn");
    const clearBtn = document.getElementById("lgClearBtn");
    const genBtn   = document.getElementById("lgGenerateBtn");
    const copyBtn  = document.getElementById("lgCopyBtn");
    const statusEl = document.getElementById("lgStatus");
    const inputEl  = document.getElementById("lgInput");
    const outEl    = document.getElementById("lgOutput");

    function setStatus(s) {
      if (statusEl) statusEl.textContent = `Status: ${s}`;
    }

    function setBusy(on) {
      busy = !!on;
      [startBtn, clearBtn, genBtn, copyBtn, inputEl].forEach(el => {
        if (!el) return;
        el.toggleAttribute("disabled", busy);
      });
      // Copy only enabled when we have output
      if (copyBtn) copyBtn.disabled = busy || !(outEl && outEl.value.trim());
    }

    function initProgressCallback(p) {
      const msg = typeof p === "string" ? p : JSON.stringify(p);
      setStatus(`loading… ${msg}`);
    }

    async function startModel() {
      if (starting || busy) return;
      if (ready && engine) return;

      if (!hasWebGPU()) {
        setStatus("WebGPU nicht verfügbar.");
        toast("WebGPU nicht verfügbar");
        return;
      }

      starting = true;
      setBusy(true);
      setStatus("initialisiere…");

      try {
        engine = new MLCEngine({ initProgressCallback });
        await engine.reload(MODEL);
        ready = true;
        setStatus("ready");
        toast("Model ready ✓");
      } catch (e) {
        console.error(e);
        ready = false;
        engine = null;
        setStatus("error (Konsole prüfen)");
        toast("Fehler beim Laden");
      } finally {
        starting = false;
        setBusy(false);
      }
    }

    function clearAll() {
      if (outEl) outEl.value = "";
      if (inputEl) inputEl.value = "";
      setStatus(ready ? "ready" : "idle");
      toast("Cleared");
      if (copyBtn) copyBtn.disabled = true;
    }

    async function generateLyrics() {
      if (busy) return;

      if (!ready || !engine) {
        toast("Bitte erst Start (Model laden)");
        setStatus("idle");
        return;
      }

      const input = (inputEl?.value || "").trim();
      if (!input) {
        toast("Input fehlt");
        return;
      }

      setBusy(true);
      setStatus("generating…");
      if (outEl) outEl.value = "";

      try {
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `INPUT:\n${input}` }
        ];

        const chunks = await engine.chat.completions.create({
          messages,
          temperature: TEMPERATURE,
          top_p: TOP_P,
          stream: true,
          max_tokens: MAX_TOKENS
        });

        let reply = "";
        for await (const chunk of chunks) {
          const delta = chunk.choices?.[0]?.delta?.content || "";
          if (delta) {
            reply += delta;
            if (outEl) outEl.value = reply;
          }
        }

        const final = cleanOutput(reply);
        if (outEl) outEl.value = final;

        setStatus("done");
        toast("Lyrics ready ✓");
        if (copyBtn) copyBtn.disabled = !final.trim();
      } catch (e) {
        console.error(e);
        const msg = String(e?.message || e || "").toLowerCase();
        if (msg.includes("disposed") || msg.includes("device was lost")) {
          ready = false;
          engine = null;
          setStatus("webgpu reset – reload");
          toast("WebGPU reset – Seite neu laden");
        } else {
          setStatus("error (Konsole prüfen)");
          toast("Fehler beim Generieren");
        }
      } finally {
        setBusy(false);
      }
    }

    // events
    if (startBtn) startBtn.addEventListener("click", startModel);
    if (clearBtn) clearBtn.addEventListener("click", clearAll);
    if (genBtn) genBtn.addEventListener("click", generateLyrics);

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const text = (outEl?.value || "").trim();
        if (text) copyText(text);
      });
    }
  }

  // Init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLyricsGeneratorUI, { once: true });
  } else {
    initLyricsGeneratorUI();
  }
}
