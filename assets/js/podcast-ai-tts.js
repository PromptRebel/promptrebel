// assets/js/podcast-ai-tts.js
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const TTS_MODEL = "Xenova/speecht5_tts";
const SPEAKER_EMBEDDINGS =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/v3.0.0/speaker_embeddings.bin";

export class PodcastAITTS {
  constructor({ statusId, audioPlayerId }) {
    this.statusEl = document.getElementById(statusId);
    this.audioPlayer = document.getElementById(audioPlayerId);

    this.synthesizer = null;
    this.ready = false;
    this.loading = false;
    this.lastAudio = null;
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  async loadModel() {
    if (this.loading) return;
    if (this.ready && this.synthesizer) return;

    this.loading = true;
    this.setStatus("Lade V2 TTS-Modell ...");

    try {
      this.synthesizer = await pipeline("text-to-speech", TTS_MODEL, {
        quantized: false,
      });

      this.ready = true;
      this.setStatus("V2 TTS-Modell bereit.");
    } catch (error) {
      console.error("AI TTS load error:", error);
      this.synthesizer = null;
      this.ready = false;
      this.setStatus(`V2 TTS-Ladefehler: ${String(error?.message || error)}`);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generateAudio(text) {
    if (!this.ready || !this.synthesizer) {
      throw new Error("V2 TTS-Modell ist nicht bereit.");
    }

    const input = (text || "").trim();
    if (!input) {
      throw new Error("Kein Text für V2-Audio vorhanden.");
    }

    this.setStatus("Erzeuge V2-Audio ...");

    const out = await this.synthesizer(input, {
      speaker_embeddings: SPEAKER_EMBEDDINGS,
    });

    if (!out?.audio || !out?.sampling_rate) {
      throw new Error("Ungültige Audioausgabe vom TTS-Modell.");
    }

    this.lastAudio = out;
    this.setStatus("V2-Audio erzeugt.");
    return out;
  }
}
