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

  // --- UI Methoden ---
  setStatus(message) { if (this.statusEl) this.statusEl.textContent = message; }
  setInfo(message) { if (this.infoEl) this.infoEl.textContent = message; }
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
    }
  }

  async ensureClient() {
    if (!this.client) this.client = new Txt2ImgClient();
    return this.client;
  }

  async checkWebGPU() {
    try {
      const client = await this.ensureClient();
      const caps = await client.detect();
      const ok = !!caps?.webgpu;
      this.setGPUStatus(ok ? "Verfügbar" : "Nicht verfügbar", ok);
      return ok;
    } catch (e) {
      this.setGPUStatus("Fehler", false);
      return false;
    }
  }

  async loadModel() {
    if (this.loading) return;
    this.loading = true;
    this.ready = false;
    this.setStatus("Lade optimiertes SD-Turbo (Small)...");
    this.setProgress(0);

    try {
      const client = await this.ensureClient();
      
      const loadRes = await client.load(
        "sd-turbo", // Wir bleiben beim Identifier, ändern aber die Parameter
        {
          backendPreference: ["webgpu"],
          // 🔥 DER IPHONE-FIX: Wir geben ein spezifisches Repository an, 
          // das kleinere ONNX-Gewichte hat oder erzwingen q4.
          modelParameters: {
            dtype: "q4",
            // Falls dein Client Custom URLs unterstützt, wäre hier der Pfad zu einem q4-Repo.
            // Die meisten Clients nutzen Xenova oder spezialisierte mobile Repos.
          },

          tokenizerProvider: async () => {
            const g = globalThis.transformers || window.transformers;
            if (!g) throw new Error("Transformers.js fehlt!");
            this.setStatus("Lade CLIP-Tokenizer...");
            const tok = await g.AutoTokenizer.from_pretrained("Xenova/clip-vit-base-patch16");
            return async (text) => {
              const res = await tok(text);
              return {
                input_ids: Array.from(res.input_ids.data),
                attention_mask: Array.from(res.attention_mask.data),
              };
            };
          },
        },
        (p) => {
          // Progress-Logik
          const pct = p.pct ?? (p.totalBytesExpected > 0 ? Math.round((p.bytesDownloaded / p.totalBytesExpected) * 100) : null);
          if (pct !== null) this.setProgress(pct);
          this.setStatus(`${p.message || "Download..."} ${pct ? pct + "%" : ""}`);
        }
      );

      if (!loadRes.ok) throw new Error(loadRes.message);

      this.ready = true;
      this.loadedModelId = "sd-turbo";
      this.setInfo("sd-turbo (q4-optimized)");
      this.setStatus("Bereit!");
      this.setProgress(100);
    } catch (error) {
      this.setStatus("Fehler: " + error.message);
      console.error(error);
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt) {
    if (!this.ready) throw new Error("Modell nicht geladen.");
    this.generating = true;
    this.setStatus("Generiere...");
    
    try {
      const client = await this.ensureClient();
      const { promise, abort } = client.generate({
        prompt,
        seed: Math.floor(Math.random() * 1000000),
        model: "sd-turbo"
      });
      this.abortCurrent = abort;
      const gen = await promise;
      
      if (gen.blob) await this.drawBlobToCanvas(gen.blob);
      this.setStatus(`Fertig in ${Math.round(gen.timeMs)}ms`);
    } catch (e) {
      this.setStatus("Fehler: " + e.message);
    } finally {
      this.generating = false;
    }
  }

  async drawBlobToCanvas(blob) {
    const bitmap = await createImageBitmap(blob);
    this.canvas.width = bitmap.width;
    this.canvas.height = bitmap.height;
    const ctx = this.canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    this.canvas.classList.remove("hidden");
    document.getElementById("imagePlaceholder").style.display = "none";
  }
}
