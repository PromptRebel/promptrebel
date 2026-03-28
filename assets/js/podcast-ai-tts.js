// assets/js/podcast-ai-tts.js
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const TTS_MODEL = "Xenova/speecht5_tts";

// Wichtig: aktuelle URL laut aktualisiertem Modellbeispiel
const SPEAKER_EMBEDDINGS_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

export class PodcastAITTS {
  constructor({ statusId, audioPlayerId }) {
    this.statusEl = document.getElementById(statusId);
    this.audioPlayer = document.getElementById(audioPlayerId);

    this.synthesizer = null;
    this.ready = false;
    this.loading = false;
    this.lastAudio = null;
    this.speakerEmbeddings = null;
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  async loadSpeakerEmbeddings() {
    if (this.speakerEmbeddings) return this.speakerEmbeddings;

    this.setStatus("Lade Speaker Embeddings ...");

    const response = await fetch(SPEAKER_EMBEDDINGS_URL, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`Speaker-Embeddings konnten nicht geladen werden (${response.status}).`);
    }

    const buffer = await response.arrayBuffer();

    // Entscheidend: Float32 braucht Byte-Länge % 4 === 0
    if (buffer.byteLength === 0) {
      throw new Error("Speaker-Embeddings sind leer.");
    }
    if (buffer.byteLength % 4 !== 0) {
      throw new Error(
        `Speaker-Embeddings ungültig: Byte-Länge ${buffer.byteLength} ist kein Vielfaches von 4.`
      );
    }

    this.speakerEmbeddings = new Float32Array(buffer);
    return this.speakerEmbeddings;
  }

  async loadModel() {
    if (this.loading) return;
    if (this.ready && this.synthesizer) return;

    this.loading = true;
    this.setStatus("Lade V2 TTS-Modell ...");

    try {
      // Laut aktualisiertem Beispiel fp32 statt quantized:false
      this.synthesizer = await pipeline("text-to-speech", TTS_MODEL, {
        dtype: "fp32",
      });

      await this.loadSpeakerEmbeddings();

      this.ready = true;
      this.setStatus("V2 TTS-Modell bereit.");
    } catch (error) {
      console.error("AI TTS load error:", error);
      this.synthesizer = null;
      this.ready = false;
      this.speakerEmbeddings = null;
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

    const speaker_embeddings = await this.loadSpeakerEmbeddings();

    const out = await this.synthesizer(input, {
      speaker_embeddings,
    });

    if (!out?.audio || !out?.sampling_rate) {
      throw new Error("Ungültige Audioausgabe vom TTS-Modell.");
    }

    this.lastAudio = out;
    this.setStatus("V2-Audio erzeugt.");
    return out;
  }
}
