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
  canvas.classList.remove("hidden");
}

function showPlaceholder(message = "Noch kein Bild generiert.") {
  canvas.classList.add("hidden");
  placeholder.classList.remove("hidden");
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
    updateButtons();
    await gen.loadModel();
  } catch (error) {
    console.error(error);
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
  showPlaceholder("Noch kein Bild generiert.");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateButtons();
});

(async function init() {
  updatePromptCount();
  await gen.checkWebGPU();
  updateButtons();
})();

