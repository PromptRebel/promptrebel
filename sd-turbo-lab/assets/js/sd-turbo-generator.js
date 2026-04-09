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
    this.setStatus("Initialisiere SD Turbo ...");
    this.setInfo("sd-turbo");
    this.setProgress(0);

    try {
      const client = await this.ensureClient();
      const caps = await client.detect();

      if (!caps?.webgpu) {
        throw new Error("WebGPU ist für SD Turbo in diesem Setup erforderlich.");
      }

      this.setGPUStatus("Verfügbar", true);

      const loadRes = await client.load(
        "sd-turbo",
        {
          backendPreference: ["webgpu"],
        },
        (p) => {
          const pct =
            typeof p?.pct === "number"
              ? p.pct
              : (typeof p?.bytesDownloaded === "number" &&
                 typeof p?.totalBytesExpected === "number" &&
                 p.totalBytesExpected > 0)
              ? Math.round((p.bytesDownloaded / p.totalBytesExpected) * 100)
              : null;

          if (pct != null) {
            this.setProgress(pct);
          }

          const sizeText =
            typeof p?.bytesDownloaded === "number" &&
            typeof p?.totalBytesExpected === "number"
              ? ` ${(p.bytesDownloaded / 1024 / 1024).toFixed(1)}/${(p.totalBytesExpected / 1024 / 1024).toFixed(1)} MB`
              : "";

          this.setStatus(`${p?.message ?? "Lade SD Turbo ..."}${pct != null ? ` ${pct}%` : ""}${sizeText}`);
        }
      );

      if (!loadRes?.ok) {
        throw new Error(loadRes?.message ?? "SD Turbo konnte nicht geladen werden.");
      }

      this.loadedModelId = "sd-turbo";
      this.ready = true;
      this.setProgress(100);
      this.setInfo(`sd-turbo (${loadRes.backendUsed ?? "webgpu"})`);
      this.setStatus("SD Turbo bereit.");

      setTimeout(() => {
        if (!this.generating) this.stopProgress();
      }, 600);
    } catch (error) {
      console.error("SD Turbo load failed:", error);
      this.ready = false;
      this.loadedModelId = null;
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      this.setInfo("SD Turbo konnte nicht geladen werden");
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generate(prompt, options = {}) {
    if (!this.ready || this.loadedModelId !== "sd-turbo") {
      throw new Error("SD Turbo ist nicht bereit.");
    }

    const text = (prompt || "").trim();
    if (!text) {
      throw new Error("Kein Prompt eingegeben.");
    }

    this.generating = true;
    this.startIndeterminate();
    this.setStatus("Generiere Bild mit SD Turbo ...");

    try {
      const client = await this.ensureClient();

      const seed =
        Number.isInteger(options.seed) ? options.seed : 42;

      const { promise, abort } = client.generate(
        {
          prompt: text,
          seed,
          model: "sd-turbo",
        },
        (e) => {
          const phase = e?.phase ? ` (${e.phase})` : "";
          this.setStatus(`Generiere Bild mit SD Turbo${phase} ...`);
        },
        {
          busyPolicy: "queue",
          debounceMs: 100,
        }
      );

      this.abortCurrent = abort;

      const gen = await promise;

      if (!gen?.ok) {
        throw new Error(gen?.message ?? gen?.reason ?? "SD Turbo Generierung fehlgeschlagen.");
      }

      if (!gen?.blob) {
        throw new Error("Kein Bild-Blob im Ergebnis gefunden.");
      }

      await this.drawBlobToCanvas(gen.blob);

      this.setStatus(`Bild fertig${typeof gen.timeMs === "number" ? ` (${Math.round(gen.timeMs)} ms)` : ""}.`);
      this.stopProgress();

      return gen;
    } catch (error) {
      console.error("SD Turbo generation failed:", error);
      this.stopProgress();
      this.setStatus(`Fehler: ${error?.message || error}`);
      throw error;
    } finally {
      this.generating = false;
      this.abortCurrent = null;
    }
  }

  async stop() {
    try {
      if (this.abortCurrent) {
        await this.abortCurrent();
      }
    } catch (error) {
      console.warn("Abort warning:", error);
    } finally {
      this.generating = false;
      this.stopProgress();
      this.setStatus("Generierung gestoppt.");
    }
  }

  async unload() {
    if (!this.client || !this.loadedModelId) return;

    try {
      await this.client.unload(this.loadedModelId);
    } catch (error) {
      console.warn("Unload warning:", error);
    } finally {
      this.ready = false;
      this.loadedModelId = null;
      this.setInfo("Noch nicht geladen");
    }
  }

  async purgeCache() {
    if (!this.client) return;

    try {
      await this.client.purge("sd-turbo");
      this.setStatus("SD-Turbo-Cache gelöscht.");
    } catch (error) {
      console.warn("Purge warning:", error);
      this.setStatus("Cache konnte nicht gelöscht werden.");
    }
  }

  async drawBlobToCanvas(blob) {
    if (!this.canvas) {
      throw new Error("Canvas nicht gefunden.");
    }

    const bitmap = await createImageBitmap(blob);
    const ctx = this.canvas.getContext("2d");

    if (!ctx) {
      throw new Error("2D-Kontext konnte nicht erstellt werden.");
    }

    this.canvas.width = bitmap.width;
    this.canvas.height = bitmap.height;
    ctx.clearRect(0, 0, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);

    const placeholder = document.getElementById("imagePlaceholder");
    if (placeholder) {
      placeholder.classList.add("hidden");
      placeholder.style.display = "none";
    }

    this.canvas.classList.remove("hidden");
    this.canvas.style.display = "block";
    this.canvas.style.visibility = "visible";
    this.canvas.style.opacity = "1";
  }
}
