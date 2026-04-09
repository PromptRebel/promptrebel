import { Txt2ImgClient } from "https://cdn.jsdelivr.net/npm/web-txt2img@0.3.1/dist/runtime/inline_client.js";

export class SDTurboGenerator {
  constructor({
    statusId,
    modelInfoId,
    canvasId,
    progressBarId,
    gpuStatusId,
  }) {
    this.statusEl = document.getElementById(statusId);
    this.infoEl = document.getElementById(modelInfoId);
    this.canvas = document.getElementById(canvasId);
    this.progressBar = document.getElementById(progressBarId);
    this.gpuStatusEl = document.getElementById(gpuStatusId);

    this.client = null;
    this.ready = false;
    this.loading = false;
    this.generating = false;
    this.abortCurrent = null;
    this.loadedModelId = null;
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  setInfo(message) {
    if (this.infoEl) this.infoEl.textContent = message;
  }

  setGPUStatus(message, ok = null) {
    if (!this.gpuStatusEl) return;
    this.gpuStatusEl.textContent = message;
    this.gpuStatusEl.classList.remove("status-ok", "status-bad");
    if (ok === true) this.gpuStatusEl.classList.add("status-ok");
    if (ok === false) this.gpuStatusEl.classList.add("status-bad");
  }

  setProgress(percent) {
    if (!this.progressBar) return;
    this.progressBar.classList.remove("indeterminate");
    if (typeof percent === "number" && Number.isFinite(percent)) {
      this.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    } else {
      this.progressBar.style.width = "0%";
    }
  }

  startIndeterminate() {
    if (!this.progressBar) return;
    this.progressBar.style.width = "30%";
    this.progressBar.classList.add("indeterminate");
  }

  stopProgress() {
    if (!this.progressBar) return;
    this.progressBar.classList.remove("indeterminate");
    this.progressBar.style.width = "0%";
  }

  async ensureClient() {
    if (!this.client) {
      this.client = new Txt2ImgClient();
    }
    return this.client;
  }

  async checkWebGPU() {
    try {
      const client = await this.ensureClient();
      const caps = await client.detect();
      const ok = !!caps?.webgpu;
      this.setGPUStatus(ok ? "Verfügbar" : "Nicht verfügbar", ok);
      return ok;
    } catch (error) {
      console.error("SD Turbo capability check failed:", error);
      this.setGPUStatus("Fehler bei Prüfung", false);
      return false;
    }
  }

  async loadModel() {
    if (this.loading) return;
    if (this.ready && this.loadedModelId === "sd-turbo") return;

    this.loading = true;
    this.ready = false;
    this.setStatus("Initialisiere SD Turbo (iPhone-Safe Modus)...");
    this.setInfo("sd-turbo (q4)");
    this.setProgress(0);

    try {
      const client = await this.ensureClient();
      const caps = await client.detect();

      if (!caps?.webgpu) {
        throw new Error("WebGPU ist erforderlich.");
      }

      this.setGPUStatus("Verfügbar", true);

      const loadRes = await client.load(
        "sd-turbo",
        {
          backendPreference: ["webgpu"],
          // 🔥 WICHTIG: Erzwinge 4-Bit Quantisierung für Mobile-RAM-Limits
          modelParameters: {
            dtype: "q4", 
          },

          // 🔥 Tokenizer-Fix: Robuste Prüfung und korrektes Format
          tokenizerProvider: async () => {
            const transformersObj = globalThis.transformers || window.transformers;
            if (!transformersObj?.AutoTokenizer) {
              throw new Error("Transformers.js (AutoTokenizer) nicht gefunden.");
            }

            this.setStatus("Lade CLIP Tokenizer...");
            const tok = await transformersObj.AutoTokenizer.from_pretrained(
              "Xenova/clip-vit-base-patch16"
            );
            tok.pad_token_id = 0;

            // SD-Turbo benötigt input_ids und attention_mask als Arrays
            return async (text) => {
              const result = await tok(text);
              return {
                input_ids: Array.from(result.input_ids.data),
                attention_mask: Array.from(result.attention_mask.data),
              };
            };
          },
        },
        (p) => {
          const pct = typeof p?.pct === "number" ? p.pct : 
                     (p?.totalBytesExpected > 0 ? Math.round((p.bytesDownloaded / p.totalBytesExpected) * 100) : null);

          if (pct != null) this.setProgress(pct);
          
          const sizeText = p?.totalBytesExpected > 0 
            ? ` ${(p.bytesDownloaded / 1024 / 1024).toFixed(1)}/${(p.totalBytesExpected / 1024 / 1024).toFixed(1)} MB`
            : "";

          this.setStatus(`${p?.message ?? "Lade SD Turbo..."}${pct != null ? ` ${pct}%` : ""}${sizeText}`);
        }
      );

      if (!loadRes?.ok) {
        throw new Error(loadRes?.message ?? "Ladefehler.");
      }

      this.loadedModelId = "sd-turbo";
      this.ready = true;
      this.setProgress(100);
      this.setStatus("SD Turbo bereit.");

      setTimeout(() => { if (!this.generating) this.stopProgress(); }, 600);
    } catch (error) {
      console.error("SD Turbo load failed:", error);
      this.ready = false;
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt, options = {}) {
    if (!this.ready) throw new Error("Nicht bereit.");

    this.generating = true;
    this.startIndeterminate();
    this.setStatus("Generiere Bild...");

    try {
      const client = await this.ensureClient();
      const seed = Number.isInteger(options.seed) ? options.seed : Math.floor(Math.random() * 1000000);

      const { promise, abort } = client.generate(
        { prompt, seed, model: "sd-turbo" },
        (e) => {
          const phase = e?.phase ? ` (${e.phase})` : "";
          this.setStatus(`Berechne Bild${phase}...`);
        }
      );

      this.abortCurrent = abort;
      const gen = await promise;

      if (!gen?.ok || !gen?.blob) throw new Error(gen?.message || "Fehler.");

      await this.drawBlobToCanvas(gen.blob);
      this.setStatus(`Bild fertig (${Math.round(gen.timeMs)} ms).`);
      this.stopProgress();
      return gen;
    } catch (error) {
      this.setStatus(`Fehler: ${error.message}`);
      this.stopProgress();
      throw error;
    } finally {
      this.generating = false;
      this.abortCurrent = null;
    }
  }

  async stop() {
    if (this.abortCurrent) await this.abortCurrent();
    this.generating = false;
    this.stopProgress();
    this.setStatus("Gestoppt.");
  }

  async drawBlobToCanvas(blob) {
    const bitmap = await createImageBitmap(blob);
    const ctx = this.canvas.getContext("2d");
    this.canvas.width = bitmap.width;
    this.canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);

    const placeholder = document.getElementById("imagePlaceholder");
    if (placeholder) {
      placeholder.style.display = "none";
      placeholder.classList.add("hidden");
    }
    this.canvas.classList.remove("hidden");
    this.canvas.style.display = "block";
  }
}
