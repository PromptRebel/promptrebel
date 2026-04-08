import {
  AutoProcessor,
  MultiModalityCausalLM,
  InterruptableStoppingCriteria,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const MODEL_ID = "onnx-community/Janus-Pro-1B-ONNX";

export class ImageGenerator {
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

    this.processor = null;
    this.model = null;
    this.ready = false;
    this.loading = false;
    this.generating = false;
    this.currentBackend = null; // "webgpu" | "wasm"
    this.stopping = new InterruptableStoppingCriteria();
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
    this.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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

  async checkWebGPU() {
    try {
      if (!("gpu" in navigator)) {
        this.setGPUStatus("Nicht verfügbar", false);
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter();
      const ok = !!adapter;

      this.setGPUStatus(ok ? "Verfügbar" : "Nicht verfügbar", ok);
      return ok;
    } catch (error) {
      console.error("WebGPU check failed:", error);
      this.setGPUStatus("Fehler bei Prüfung", false);
      return false;
    }
  }

  getProgressCallback() {
    return (data) => {
      if (!data) return;

      if (data.status === "progress") {
        const total = Number(data.total || 1);
        const loaded = Number(data.loaded || 0);
        const progress = Math.round((loaded / total) * 100);
        this.setProgress(progress);
        this.setStatus(`Lade ${data.file || "Modell"}: ${progress}%`);
      } else if (data.status === "done") {
        this.setProgress(100);
        this.setStatus(`Datei fertig: ${data.file || "unbekannt"}`);
      } else if (data.status === "ready") {
        this.setStatus("Modell geladen. Initialisiere Engine...");
        this.setProgress(100);
      }
    };
  }

  async ensureProcessor(progress_callback) {
    if (this.processor) return;

    this.processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback,
    });
  }

  async loadModel(preferredBackend = "auto") {
    if (this.loading) return;
    if (this.ready && this.model && this.processor) return;

    this.loading = true;
    this.ready = false;
    this.setStatus("Initialisiere KI-Engine...");
    this.setInfo(MODEL_ID);
    this.setProgress(0);

    try {
      const hasWebGPU = await this.checkWebGPU();
      const progress_callback = this.getProgressCallback();

      await this.ensureProcessor(progress_callback);

      const wantAuto = preferredBackend === "auto";
      const tryWebGPU = preferredBackend === "webgpu" || (wantAuto && hasWebGPU);
      let loaded = false;

      if (tryWebGPU) {
        try {
          this.setStatus("Versuche WebGPU-Beschleunigung...");
          this.model = await MultiModalityCausalLM.from_pretrained(MODEL_ID, {
            device: "webgpu",
            dtype: "q4",
            progress_callback,
          });

          this.currentBackend = "webgpu";
          this.setInfo(`${MODEL_ID} (q4, WebGPU)`);
          loaded = true;
        } catch (gpuError) {
          console.warn("WebGPU fehlgeschlagen, wechsle zu WASM...", gpuError);
          this.model = null;
          this.currentBackend = null;

          if (preferredBackend === "webgpu") {
            throw gpuError;
          }
        }
      }

      if (!loaded) {
        this.setStatus("Lade CPU-Modus (WASM) – Sicherer Modus...");
        this.model = await MultiModalityCausalLM.from_pretrained(MODEL_ID, {
          device: "wasm",
          dtype: "q8",
          progress_callback,
        });

        this.currentBackend = "wasm";
        this.setInfo(`${MODEL_ID} (q8, WASM)`);
      }

      this.ready = true;
      this.setStatus("System bereit.");
      this.setProgress(100);

      setTimeout(() => {
        if (!this.generating) this.stopProgress();
      }, 600);
    } catch (error) {
      console.error("Model load failed:", error);
      this.processor = null;
      this.model = null;
      this.currentBackend = null;
      this.ready = false;
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      this.setInfo("Modell konnte nicht geladen werden");
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async switchToWasmFallback() {
    this.setStatus("WebGPU fehlgeschlagen – lade WASM-Fallback...");
    this.setProgress(0);

    try {
      this.model = null;
      this.ready = false;
      this.currentBackend = null;

      const progress_callback = this.getProgressCallback();

      await this.ensureProcessor(progress_callback);

      this.model = await MultiModalityCausalLM.from_pretrained(MODEL_ID, {
        device: "wasm",
        dtype: "q8",
        progress_callback,
      });

      this.currentBackend = "wasm";
      this.ready = true;
      this.setInfo(`${MODEL_ID} (q8, WASM)`);
      this.setStatus("WASM-Fallback bereit.");
      this.setProgress(100);

      setTimeout(() => {
        if (!this.generating) this.stopProgress();
      }, 600);
    } catch (error) {
      console.error("WASM fallback failed:", error);
      this.model = null;
      this.currentBackend = null;
      this.ready = false;
      this.stopProgress();
      this.setStatus(`Fallback-Fehler: ${error?.message || error}`);
      this.setInfo("WASM-Fallback fehlgeschlagen");
      throw error;
    }
  }

  async generate(prompt) {
    if (!this.ready || !this.model || !this.processor) {
      throw new Error("Modell nicht bereit.");
    }

    const text = (prompt || "").trim();
    if (!text) {
      throw new Error("Kein Prompt eingegeben.");
    }

    this.generating = true;
    this.stopping.reset();
    this.setStatus(`Bereite Prompt vor (${this.currentBackend || "unbekannt"}) ...`);
    this.startIndeterminate();

    try {
      return await this.generateWithCurrentModel(text);
    } catch (error) {
      console.error("Image generation failed:", error);

      const canFallback =
        this.currentBackend === "webgpu";

      if (canFallback) {
        console.warn("WebGPU-Generierung fehlgeschlagen, versuche WASM-Fallback...");
        this.setStatus("WebGPU-Generierung fehlgeschlagen – wechsle zu WASM...");
        this.stopProgress();

        await this.switchToWasmFallback();

        this.startIndeterminate();
        this.setStatus("Generiere Bild erneut im WASM-Modus ...");

        const result = await this.generateWithCurrentModel(text);
        return result;
      }

      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      throw error;
    } finally {
      this.generating = false;
    }
  }

  async generateWithCurrentModel(text) {
    const conversation = [
      {
        role: "<|User|>",
        content: text,
      },
    ];

    const inputs = await this.processor(conversation, {
      chat_template: "text_to_image",
    });

    const numImageTokens = this.processor.num_image_tokens;
    this.setStatus(`Generiere Bild (${this.currentBackend || "unbekannt"}) ...`);

    const outputs = await this.model.generate_images({
      ...inputs,
      min_new_tokens: numImageTokens,
      max_new_tokens: numImageTokens,
      do_sample: true,
      stopping_criteria: this.stopping,
    });

    const firstImage = outputs?.[0];
    console.log("Image Output:", firstImage);
    console.log("All Outputs:", outputs);

    if (!firstImage) {
      throw new Error("Kein Bild im Modell-Output gefunden.");
    }

    await this.renderImageToCanvas(firstImage);

    this.setStatus("Bild fertig.");
    this.stopProgress();

    return firstImage;
  }

  stop() {
    this.stopping.interrupt();
    this.generating = false;
    this.stopProgress();
    this.setStatus("Generierung gestoppt.");
  }

  async renderImageToCanvas(imageOutput) {
    if (!this.canvas) {
      throw new Error("Canvas nicht gefunden.");
    }

    console.log("Render Output:", imageOutput);
    console.log("firstImage keys:", Object.keys(imageOutput ?? {}));
    console.log("firstImage type:", typeof imageOutput);
    console.log("has data:", !!imageOutput?.data);
    console.log("has width:", !!imageOutput?.width);
    console.log("has height:", !!imageOutput?.height);
    console.log("has channels:", !!imageOutput?.channels);
    console.log("RAW RENDERPFAD ERZWUNGEN");

    try {
      const data = imageOutput?.data ?? imageOutput?.rgb;
      const width = imageOutput?.width;
      const height = imageOutput?.height;

      console.log("data length:", data?.length, "width:", width, "height:", height);

      if (!data || !width || !height) {
        throw new Error("Rohdaten fehlen für direkten Canvas-Render.");
      }

      const rgba = new Uint8ClampedArray(width * height * 4);

      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        rgba[j] = data[i];
        rgba[j + 1] = data[i + 1];
        rgba[j + 2] = data[i + 2];
        rgba[j + 3] = 255;
      }

      const ctx = this.canvas.getContext("2d");
      if (!ctx) {
        throw new Error("2D-Kontext konnte nicht erstellt werden.");
      }

      this.canvas.width = width;
      this.canvas.height = height;

      const imageData = new ImageData(rgba, width, height);
      ctx.putImageData(imageData, 0, 0);

      this.forceShowCanvas();

      const probe = ctx.getImageData(0, 0, 1, 1).data;
      console.log("Canvas first pixel:", Array.from(probe));
      console.log("Canvas classes after render:", this.canvas.className);
      console.log("Canvas display:", getComputedStyle(this.canvas).display);
      console.log("Canvas visibility:", getComputedStyle(this.canvas).visibility);
      console.log("Canvas opacity:", getComputedStyle(this.canvas).opacity);
      console.log("Canvas size:", this.canvas.width, this.canvas.height);

      return;
    } catch (renderErr) {
      console.error("RENDER CRASH:", renderErr);
      throw renderErr;
    }
  }

  forceShowCanvas() {
    const placeholder = document.getElementById("imagePlaceholder");

    if (placeholder) {
      placeholder.classList.add("hidden");
      placeholder.style.display = "none";
    }

    if (this.canvas) {
      this.canvas.classList.remove("hidden");
      this.canvas.style.display = "block";
      this.canvas.style.visibility = "visible";
      this.canvas.style.opacity = "1";
    }
  }

  async drawDataUrlToCanvas(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;

        const ctx = this.canvas.getContext("2d");
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve();
      };

      img.onerror = reject;
      img.src = dataUrl;
    });
  }
}
