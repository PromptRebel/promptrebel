// assets/js/podcast-transformers.js
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const DEFAULT_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
const MAX_NEW_TOKENS = 180;

export class PodcastTransformersLLM {
  constructor({ statusId, engineInfoId, outputId }) {
    this.statusEl = document.getElementById(statusId);
    this.engineInfoEl = document.getElementById(engineInfoId);
    this.outputEl = document.getElementById(outputId);

    this.generator = null;
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
    if (this.ready && this.generator) return;

    this.loading = true;
    this.setStatus("Initialisiere Modell ...");
    this.setEngineInfo("Modell wird geladen ...");

    try {
      // Optional defensiver:
      env.allowLocalModels = false;

      const useWebGPU = this.hasWebGPU();
      const device = useWebGPU ? "webgpu" : "wasm";

      this.setStatus(`Lade Modell über ${device.toUpperCase()} ...`);

      this.generator = await pipeline(
        "text-generation",
        this.modelName,
        {
          device,
          dtype: useWebGPU ? "q4" : "q8",
        }
      );

      this.ready = true;
      this.setStatus("Modell bereit.");
      this.setEngineInfo(`Modell: ${this.modelName} (${device})`);
    } catch (error) {
      console.error("Transformers.js model load error:", error);
      this.generator = null;
      this.ready = false;

      const msg = String(error?.message || error || "Unbekannter Fehler");
      this.setStatus(`Modelldownload/Initialisierung fehlgeschlagen: ${msg}`);
      this.setEngineInfo("Modell: Ladefehler");

      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt) {
    if (!this.ready || !this.generator) {
      throw new Error("Modell nicht bereit.");
    }

    const userPrompt = (prompt || "").trim();
    if (!userPrompt) {
      throw new Error("Kein Thema eingegeben.");
    }

    this.setStatus("Erzeuge Skript ...");

    const systemInstruction = [
      "Du schreibst kurze, klar verständliche Mini-Podcast-Skripte auf Deutsch.",
      "Regeln:",
      "- Schreibe angenehm, natürlich und kompakt.",
      "- Keine Begrüßungsfloskeln wie 'Hallo zusammen' am Anfang.",
      "- Länge: ungefähr 130 bis 190 Wörter.",
      "- Struktur: 1) Einstieg, 2) Kernidee, 3) kurzes Fazit.",
      "- Nutze verständliche Sprache statt Fachjargon.",
      "- Gib nur den finalen Sprechtext aus, ohne Überschrift und ohne Meta-Kommentare."
    ].join("\n");

    const fullPrompt = `${systemInstruction}\n\nThema: ${userPrompt}\n\nSprechtext:`;

    const result = await this.generator(fullPrompt, {
      max_new_tokens: MAX_NEW_TOKENS,
      do_sample: false,
      temperature: 0.2,
      return_full_text: false,
    });

    const raw = Array.isArray(result)
      ? (result[0]?.generated_text || "")
      : (result?.generated_text || "");

    const finalText = raw.trim();

    if (!finalText) {
      throw new Error("Leere Modellantwort.");
    }

    if (this.outputEl) {
      this.outputEl.textContent = finalText;
    }

    this.setStatus("Skript erzeugt.");
    return finalText;
  }
}
