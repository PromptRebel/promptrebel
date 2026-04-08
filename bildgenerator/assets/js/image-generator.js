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

  async loadModel() {
    if (this.loading) return;
    if (this.ready && this.model && this.processor) return;

    this.loading = true;
    this.ready = false;
    this.setStatus("Initialisiere Modell-Download ...");
    this.setInfo(MODEL_ID);
    this.setProgress(0);

    try {
      // WebGPU nur informativ prüfen
      await this.checkWebGPU();

      const progress_callback = (data) => {
        if (!data) return;

        if (data.status === "progress") {
          const total = Number(data.total || 0);
          const loaded = Number(data.loaded || 0);
          const file = data.file || "Datei";

          if (total > 0) {
            const progress = Math.round((loaded / total) * 100);
            this.setProgress(progress);
            this.setStatus(`Lade ${file}: ${progress}%`);
          } else {
            this.setStatus(`Lade ${file} ...`);
          }
        } else if (data.status === "done") {
          this.setProgress(100);
          this.setStatus(`Datei fertig: ${data.file || "unbekannt"}`);
        } else if (data.status === "ready") {
          this.setStatus("Modell geladen. Initialisiere WASM ...");
          this.setProgress(100);
        }
      };

      this.processor = await AutoProcessor.from_pretrained(MODEL_ID, {
        progress_callback,
      });

      this.model = await MultiModalityCausalLM.from_pretrained(MODEL_ID, {
        device: "wasm",
        dtype: "q8",
        progress_callback,
      });

      this.ready = true;
      this.setStatus("Modell bereit.");
      this.setInfo(`${MODEL_ID} (q8, WASM)`);
      this.setProgress(100);

      setTimeout(() => {
        if (!this.generating) this.stopProgress();
      }, 600);
    } catch (error) {
      console.error("Model load failed:", error);
      this.processor = null;
      this.model = null;
      this.ready = false;
      this.stopProgress();
      this.setStatus(`Ladefehler: ${error?.message || error}`);
      this.setInfo("Modell konnte nicht geladen werden");
      throw error;
    } finally {
      this.loading = false;
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
    this.setStatus("Bereite Prompt vor ...");
    this.startIndeterminate();

    try {
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
      this.setStatus("Generiere Bild ...");

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
    } catch (error) {
      console.error("Image generation failed:", error);
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      throw error;
    } finally {
      this.generating = false;
    }
  }

  stop() {
    this.stopping.interrupt();
    this.setStatus("Generierung gestoppt.");
    this.generating = false;
    this.stopProgress();
  }

  async renderImageToCanvas(imageOutput) {
    if (!this.canvas) return;

    console.log("Render Output:", imageOutput);

    // Fall 1: Objekt mit toCanvas()
    if (typeof imageOutput?.toCanvas === "function") {
      await imageOutput.toCanvas(this.canvas);
      return;
    }

    // Fall 2: Objekt mit toDataURL()
    if (typeof imageOutput?.toDataURL === "function") {
      const dataUrl = imageOutput.toDataURL();
      await this.drawDataUrlToCanvas(dataUrl);
      return;
    }

    // Fall 3: ImageData direkt
    if (imageOutput instanceof ImageData) {
      this.canvas.width = imageOutput.width;
      this.canvas.height = imageOutput.height;
      const ctx = this.canvas.getContext("2d");
      ctx.putImageData(imageOutput, 0, 0);
      return;
    }

    // Fall 4: Rohobjekt { data, width, height }
    if (
      imageOutput &&
      imageOutput.data &&
      imageOutput.width &&
      imageOutput.height
    ) {
      this.canvas.width = imageOutput.width;
      this.canvas.height = imageOutput.height;

      const ctx = this.canvas.getContext("2d");
      const imgData = new ImageData(
        new Uint8ClampedArray(imageOutput.data),
        imageOutput.width,
        imageOutput.height
      );
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    // Fall 5: Tensor-artige Struktur mit dims + data
    if (
      imageOutput &&
      imageOutput.data &&
      Array.isArray(imageOutput.dims) &&
      imageOutput.dims.length >= 2
    ) {
      const dims = imageOutput.dims;
      const height = dims[dims.length - 2];
      const width = dims[dims.length - 1];

      if (width && height) {
        this.canvas.width = width;
        this.canvas.height = height;

        const ctx = this.canvas.getContext("2d");
        const raw = new Uint8ClampedArray(imageOutput.data);

        // Falls nur Graustufen oder unerwartetes Format kommt,
        // versuchen wir es direkt als RGBA nur wenn Länge passt.
        if (raw.length === width * height * 4) {
          const imgData = new ImageData(raw, width, height);
          ctx.putImageData(imgData, 0, 0);
          return;
        }
      }
    }

    throw new Error("Unbekanntes Bildformat – kann nicht gerendert werden.");
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
