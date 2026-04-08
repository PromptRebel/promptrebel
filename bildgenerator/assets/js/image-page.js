import { ImageGenerator } from "./image-generator.js";

const promptInput = document.getElementById("imagePrompt");
const promptCount = document.getElementById("imagePromptCount");

const btnLoad = document.getElementById("btnLoadImageModelV1");
const btnGenerate = document.getElementById("btnGenerateImage");
const btnStop = document.getElementById("btnStopImage");
const btnDownload = document.getElementById("btnDownloadImage");
const btnClear = document.getElementById("btnClearImage");

const canvas = document.getElementById("imageCanvas");
const placeholder = document.getElementById("imagePlaceholder");

const gen = new ImageGenerator({
  statusId: "imageStatus",
  modelInfoId: "imageModelInfo",
  canvasId: "imageCanvas",
  progressBarId: "modelProgressBar",
  gpuStatusId: "gpuStatus",
});

let busy = false;

function updateButtons() {
  const hasPrompt = !!promptInput.value.trim();

  btnLoad.disabled = busy || gen.ready;
  btnGenerate.disabled = busy || !gen.ready || !hasPrompt;
  btnStop.disabled = !busy;
  btnDownload.disabled = busy || canvas.classList.contains("hidden");
  btnClear.disabled = busy;
}

function showCanvas() {
  placeholder.classList.add("hidden");
  placeholder.style.display = "none";

  canvas.classList.remove("hidden");
  canvas.style.display = "block";
  canvas.style.visibility = "visible";
  canvas.style.opacity = "1";
}

function showPlaceholder(message = "Noch kein Bild generiert.") {
  canvas.classList.add("hidden");
  canvas.style.display = "none";

  placeholder.classList.remove("hidden");
  placeholder.style.display = "block";
  placeholder.textContent = message;
}

function updatePromptCount() {
  promptCount.textContent = `${promptInput.value.length} / 400`;
}

promptInput.addEventListener("input", () => {
  updatePromptCount();
  updateButtons();
});

btnLoad.addEventListener("click", async () => {
  try {
    busy = true;
    showPlaceholder("Lade Modell ...");
    updateButtons();

    // auto = zuerst WebGPU versuchen, dann WASM-Fallback
    await gen.loadModel("auto");
  } catch (error) {
    console.error(error);
    showPlaceholder("Fehler beim Laden des Modells.");
  } finally {
    busy = false;
    updateButtons();
  }
});

btnGenerate.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  try {
    busy = true;
    showPlaceholder("Generiere Bild ...");
    updateButtons();

    await gen.generate(prompt);
    showCanvas();
  } catch (error) {
    console.error(error);
    showPlaceholder("Fehler bei der Generierung.");
  } finally {
    busy = false;
    updateButtons();
  }
});

btnStop.addEventListener("click", () => {
  gen.stop();
  busy = false;
  updateButtons();
});

btnDownload.addEventListener("click", () => {
  if (canvas.classList.contains("hidden")) return;

  const link = document.createElement("a");
  link.download = "promptrebel-image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

btnClear.addEventListener("click", () => {
  promptInput.value = "";
  updatePromptCount();

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  showPlaceholder("Noch kein Bild generiert.");
  updateButtons();
});

(async function init() {
  updatePromptCount();
  await gen.checkWebGPU();
  updateButtons();
})();
