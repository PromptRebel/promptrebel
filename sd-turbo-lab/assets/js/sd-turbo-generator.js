import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0";

export class SDTurboGenerator {
  constructor({ statusId, modelInfoId, canvasId, progressBarId, gpuStatusId }) {
    this.statusEl = document.getElementById(statusId);
    this.infoEl = document.getElementById(modelInfoId);
    this.canvas = document.getElementById(canvasId);
    this.progressBar = document.getElementById(progressBarId);
    this.gpuStatusEl = document.getElementById(gpuStatusId);

    this.pipe = null;
    this.ready = false;
    this.loading = false;
  }

  // --- UI HELPER ---
  setStatus(msg) { if (this.statusEl) this.statusEl.textContent = msg; }
  setInfo(msg) { if (this.infoEl) this.infoEl.textContent = msg; }
  setProgress(pct) {
    if (this.progressBar) this.progressBar.style.width = `${pct}%`;
  }

  async loadModel() {
    if (this.loading || this.ready) return;
    this.loading = true;
    this.setStatus("Lade iPhone-optimiertes SD-Turbo (q4)...");

    try {
      // Wir nutzen direkt die Pipeline-API von Transformers.js v3
      // Das Modell wird hier explizit als quantisierte Version angefordert
      this.pipe = await pipeline("text-to-image", "onnx-community/sd-turbo-ONNX", {
        device: "webgpu",
        dtype: "q4", // ⚡ DAS IST DER KEY: Lädt nur ca. 700-800 MB!
        progress_callback: (p) => {
          if (p.status === "progress") {
            const pct = Math.round(p.loaded / p.total * 100);
            this.setProgress(pct);
            this.setStatus(`Lade ${p.file}: ${pct}%`);
          }
        }
      });

      this.ready = true;
      this.setStatus("SD-Turbo (Mobile-Safe) bereit!");
      this.setInfo("sd-turbo (q4, WebGPU)");
    } catch (e) {
      this.setStatus("Fehler: " + e.message);
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt) {
    if (!this.ready) return;
    this.setStatus("Generiere Bild...");
    
    try {
      // SD-Turbo braucht nur 1 Step!
      const output = await this.pipe(prompt, {
        num_inference_steps: 1,
        guidance_scale: 0.0, 
      });

      const canvas = this.canvas;
      const ctx = canvas.getContext("2d");
      
      // Das Output-Bild von Transformers.js v3 ist meist ein RawImage-Objekt
      const image = output[0]; 
      canvas.width = image.width;
      canvas.height = image.height;
      
      // Zeichnen auf den Canvas
      const bitmap = await createImageBitmap(image.toBlob());
      ctx.drawImage(bitmap, 0, 0);

      canvas.classList.remove("hidden");
      document.getElementById("imagePlaceholder").style.display = "none";
      this.setStatus("Fertig!");
    } catch (e) {
      this.setStatus("Generierungsfehler: " + e.message);
    }
  }
}
