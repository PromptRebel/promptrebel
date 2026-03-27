// assets/js/podcast-llm.js
import { MLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.80";

const DEFAULT_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC";
const TEMPERATURE = 0.6;
const MAX_TOKENS = 260;

export class PodcastLLM {
  constructor({ statusId, engineInfoId, outputId }) {
    this.statusEl = document.getElementById(statusId);
    this.engineInfoEl = document.getElementById(engineInfoId);
    this.outputEl = document.getElementById(outputId);

    this.engine = null;
    this.ready = false;
    this.loading = false;
    this.modelName = DEFAULT_MODEL;
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  setEngineInfo(message) {
    if (this.engineInfoEl) this.engineInfoEl.textContent = message;
  }

  hasWebGPU() {
    return !!navigator.gpu;
  }

  async loadModel() {
    if (this.loading) return;
    if (this.ready && this.engine) return;

    if (!this.hasWebGPU()) {
      this.setStatus("WebGPU nicht verfügbar. Nutze idealerweise Desktop Chrome oder Edge.");
      throw new Error("WebGPU nicht verfügbar.");
    }

    this.loading = true;
    this.setStatus("Initialisiere Modell ...");
    this.setEngineInfo("Modell wird geladen ...");

    try {
      const initProgressCallback = (progress) => {
        const msg = typeof progress === "string" ? progress : JSON.stringify(progress);
        this.setStatus(`Lade Modell: ${msg}`);
      };

      this.engine = new MLCEngine({ initProgressCallback });
      await this.engine.reload(this.modelName);

      this.ready = true;
      this.setStatus("Modell bereit.");
      this.setEngineInfo(`Modell: ${this.modelName}`);
    } catch (error) {
      console.error(error);
      this.engine = null;
      this.ready = false;
      this.setStatus("Fehler beim Laden des Modells.");
      this.setEngineInfo("Modell: Ladefehler");
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt) {
    if (!this.ready || !this.engine) {
      throw new Error("Modell nicht bereit.");
    }

    const userPrompt = (prompt || "").trim();
    if (!userPrompt) {
      throw new Error("Kein Thema eingegeben.");
    }

    this.setStatus("Erzeuge Skript ...");

    const messages = [
      {
        role: "system",
        content: [
          "Du schreibst kurze, klar verständliche Mini-Podcast-Skripte auf Deutsch.",
          "Regeln:",
          "- Schreibe angenehm, natürlich und kompakt.",
          "- Keine Begrüßungsfloskeln wie 'Hallo zusammen' am Anfang.",
          "- Länge: ungefähr 130 bis 190 Wörter.",
          "- Struktur: 1) Einstieg, 2) Kernidee, 3) kurzes Fazit.",
          "- Nutze verständliche Sprache statt Fachjargon.",
          "- Gib nur den finalen Sprechtext aus, ohne Überschrift und ohne Meta-Kommentare."
        ].join("\n")
      },
      {
        role: "user",
        content: `Thema für ein kurzes Podcast-Skript: ${userPrompt}`
      }
    ];

    const chunks = await this.engine.chat.completions.create({
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

        if (this.outputEl) {
          this.outputEl.textContent = reply.trim();
        }
      }
    }

    const finalText = reply.trim();

    if (!finalText) {
      throw new Error("Leere Modellantwort.");
    }

    this.setStatus("Skript erzeugt.");
    return finalText;
  }
}
