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

    this.ready = false;
    this.loading = false;
    this.generating = false;
    this.backend = null;
    this.pipeline = null; // Platzhalter für spätere SD-Turbo-Engine
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
    if (this.ready) return;

    this.loading = true;
    this.ready = false;
    this.setStatus("Initialisiere SD Turbo Lab ...");
    this.setInfo("SD Turbo noch nicht verbunden");
    this.setProgress(0);

    try {
      const hasWebGPU = await this.checkWebGPU();

      if (!hasWebGPU) {
        throw new Error("WebGPU ist für SD Turbo voraussichtlich erforderlich.");
      }

      this.setStatus("Bereite SD-Turbo-Engine vor ...");
      this.setProgress(15);

      // Platzhalter:
      // Hier kommt später der echte SD-Turbo-Ladepfad rein.
      // Z. B. ONNX Runtime Web / WebGPU / Modellartefakte / Scheduler / Decoder etc.

      await this.fakeDelay(1200);

      this.pipeline = {
        name: "sd-turbo-placeholder-pipeline",
      };

      this.backend = "webgpu";
      this.ready = true;
      this.setStatus("SD Turbo Grundgerüst bereit.");
      this.setInfo("SD Turbo Lab (Scaffold, WebGPU vorgesehen)");
      this.setProgress(100);

      setTimeout(() => {
        if (!this.generating) this.stopProgress();
      }, 600);
    } catch (error) {
      console.error("SD Turbo load failed:", error);
      this.pipeline = null;
      this.backend = null;
      this.ready = false;
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      this.setInfo("SD Turbo konnte nicht geladen werden");
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt) {
    if (!this.ready || !this.pipeline) {
      throw new Error("SD Turbo ist nicht bereit.");
    }

    const text = (prompt || "").trim();
    if (!text) {
      throw new Error("Kein Prompt eingegeben.");
    }

    this.generating = true;
    this.setStatus("Generiere Bild mit SD Turbo ...");
    this.startIndeterminate();

    try {
      // Platzhalter:
      // Hier kommt später die echte SD-Turbo-Inferenz rein.
      await this.fakeDelay(1400);

      const imageData = this.createDemoImage(text);
      await this.renderImageToCanvas(imageData);

      this.setStatus("Bild fertig.");
      this.stopProgress();
      return imageData;
    } catch (error) {
      console.error("SD Turbo generation failed:", error);
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      throw error;
    } finally {
      this.generating = false;
    }
  }

  stop() {
    this.generating = false;
    this.stopProgress();
    this.setStatus("Generierung gestoppt.");
  }

  async renderImageToCanvas(imageData) {
    if (!this.canvas) {
      throw new Error("Canvas nicht gefunden.");
    }

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D-Kontext konnte nicht erstellt werden.");
    }

    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
  }

  createDemoImage(prompt) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#0ea5e9");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * 512,
        Math.random() * 512,
        20 + Math.random() * 100,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 26px system-ui";
    ctx.fillText("PROMPTREBEL · SD TURBO LAB", 28, 50);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "18px system-ui";

    const lines = this.wrapText(ctx, prompt, 28, 96, 456, 28);
    lines.forEach((line, index) => {
      ctx.fillText(line, 28, 96 + index * 28);
    });

    return ctx.getImageData(0, 0, 512, 512);
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) lines.push(line);
    return lines.slice(0, 12);
  }

  fakeDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
