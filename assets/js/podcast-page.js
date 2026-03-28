// assets/js/podcast-page.js
import { PodcastTTS } from "./podcast-tts.js";
import { PodcastTransformersLLM } from "./podcast-transformers.js";

const promptInput = document.getElementById("podcastPrompt");
const promptCount = document.getElementById("promptCount");

const btnLoadModel = document.getElementById("btnLoadModel");
const btnGenerate = document.getElementById("btnGenerate");
const btnSpeak = document.getElementById("btnSpeak");
const btnPause = document.getElementById("btnPause");
const btnResume = document.getElementById("btnResume");
const btnStop = document.getElementById("btnStop");

const statusEl = document.getElementById("status");
const outputText = document.getElementById("outputText");

const llm = new PodcastTransformersLLM({
  statusId: "status",
  engineInfoId: "engineInfo",
  outputId: "outputText",
});

const tts = new PodcastTTS({
  voiceSelectId: "voiceSelect",
  statusId: "status",
});

let latestScript = "";
let busy = false;

function setBusy(on) {
  busy = !!on;

  btnLoadModel.disabled = busy;
  btnGenerate.disabled = busy || !llm.ready;
  promptInput.disabled = busy;

  updateSpeakButtons();
}

function updateCharCount() {
  promptCount.textContent = `${promptInput.value.length} / 600`;
}

function updateSpeakButtons() {
  const hasText = !!latestScript.trim();
  btnSpeak.disabled = busy || !hasText;
  btnPause.disabled = busy || !hasText;
  btnResume.disabled = busy || !hasText;
  btnStop.disabled = busy || !hasText;
}

promptInput.addEventListener("input", updateCharCount);

btnLoadModel.addEventListener("click", async () => {
  try {
    setBusy(true);
    await llm.loadModel();
    btnGenerate.disabled = false;
    statusEl.textContent = "Modell bereit. Du kannst jetzt ein Skript erzeugen.";
  } catch (error) {
    console.error(error);
    const msg = String(error?.message || error || "Unbekannter Fehler");
    statusEl.textContent = `Modell konnte nicht geladen werden: ${msg}`;
  } finally {
    setBusy(false);
  }
});

btnGenerate.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    statusEl.textContent = "Bitte zuerst ein Thema eingeben.";
    return;
  }

  try {
    setBusy(true);
    outputText.textContent = "Skript wird erzeugt ...";
    latestScript = await llm.generate(prompt);
  } catch (error) {
    console.error(error);
    latestScript = "";
    outputText.textContent = "Fehler bei der Skripterzeugung.";
    statusEl.textContent = `Das Skript konnte nicht erzeugt werden: ${String(error?.message || error)}`;
  } finally {
    setBusy(false);
  }
});

btnSpeak.addEventListener("click", () => {
  if (!latestScript.trim()) return;
  tts.speak(latestScript);
});

btnPause.addEventListener("click", () => tts.pause());
btnResume.addEventListener("click", () => tts.resume());
btnStop.addEventListener("click", () => tts.stop());

function initPage() {
  updateCharCount();
  tts.init();
  updateSpeakButtons();
}

initPage();
