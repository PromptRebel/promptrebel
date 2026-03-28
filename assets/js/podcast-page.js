// assets/js/podcast-page.js
import { PodcastTTS } from "./podcast-tts.js";
import { PodcastTransformersLLM } from "./podcast-transformers.js";
import { PodcastAITTS } from "./podcast-ai-tts.js";
import { float32ToWavBlob, attachBlobToAudioPlayer, downloadBlob } from "./wav-export.js";

const promptInput = document.getElementById("podcastPrompt");
const promptCount = document.getElementById("promptCount");

const btnLoadModel = document.getElementById("btnLoadModel");
const btnGenerate = document.getElementById("btnGenerate");
const btnSpeak = document.getElementById("btnSpeak");
const btnPause = document.getElementById("btnPause");
const btnResume = document.getElementById("btnResume");
const btnStop = document.getElementById("btnStop");

const btnLoadV2TTS = document.getElementById("btnLoadV2TTS");
const btnGenerateAudio = document.getElementById("btnGenerateAudio");
const btnDownloadWav = document.getElementById("btnDownloadWav");

const statusEl = document.getElementById("status");
const v2StatusEl = document.getElementById("v2Status");
const outputText = document.getElementById("outputText");
const audioPlayer = document.getElementById("audioPlayer");

const llm = new PodcastTransformersLLM({
  statusId: "status",
  engineInfoId: "engineInfo",
  outputId: "outputText",
});

const tts = new PodcastTTS({
  voiceSelectId: "voiceSelect",
  statusId: "status",
});

const aiTts = new PodcastAITTS({
  statusId: "v2Status",
  audioPlayerId: "audioPlayer",
});

let latestScript = "";
let latestWavBlob = null;
let busyTextModel = false;
let busyTextGeneration = false;
let busyV2 = false;

function updateCharCount() {
  promptCount.textContent = `${promptInput.value.length} / 600`;
}

function updateV1Buttons() {
  const hasScript = !!latestScript.trim();

  btnLoadModel.disabled = busyTextModel || busyTextGeneration;
  btnGenerate.disabled = busyTextModel || busyTextGeneration || !llm.ready;
  promptInput.disabled = busyTextModel || busyTextGeneration;

  btnSpeak.disabled = busyTextModel || busyTextGeneration || !hasScript;
  btnPause.disabled = busyTextModel || busyTextGeneration || !hasScript;
  btnResume.disabled = busyTextModel || busyTextGeneration || !hasScript;
  btnStop.disabled = busyTextModel || busyTextGeneration || !hasScript;
}

function updateV2Buttons() {
  const hasScript = !!latestScript.trim();
  const hasAudio = !!latestWavBlob;

  btnLoadV2TTS.disabled = busyV2;
  btnGenerateAudio.disabled = busyV2 || !aiTts.ready || !hasScript;
  btnDownloadWav.disabled = busyV2 || !hasAudio;
}

function updateAllButtons() {
  updateV1Buttons();
  updateV2Buttons();
}

function resetV2AudioState() {
  latestWavBlob = null;
  btnDownloadWav.disabled = true;
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
}

promptInput.addEventListener("input", updateCharCount);

btnLoadModel.addEventListener("click", async () => {
  try {
    busyTextModel = true;
    updateAllButtons();

    await llm.loadModel();
    statusEl.textContent = "Textmodell bereit. Du kannst jetzt ein Skript erzeugen.";
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Textmodell konnte nicht geladen werden: ${String(error?.message || error)}`;
  } finally {
    busyTextModel = false;
    updateAllButtons();
  }
});

btnGenerate.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    statusEl.textContent = "Bitte zuerst ein Thema eingeben.";
    return;
  }

  try {
    busyTextGeneration = true;
    latestScript = "";
    outputText.textContent = "Skript wird erzeugt ...";
    resetV2AudioState();
    updateAllButtons();

    latestScript = await llm.generate(prompt);
    statusEl.textContent = "Skript erzeugt. V1 und V2 können jetzt verwendet werden.";

    if (aiTts.ready) {
      btnGenerateAudio.disabled = false;
    }
  } catch (error) {
    console.error(error);
    latestScript = "";
    outputText.textContent = "Fehler bei der Skripterzeugung.";
    statusEl.textContent = `Das Skript konnte nicht erzeugt werden: ${String(error?.message || error)}`;
  } finally {
    busyTextGeneration = false;
    updateAllButtons();
  }
});

btnSpeak.addEventListener("click", () => {
  if (!latestScript.trim()) return;
  tts.speak(latestScript);
});

btnPause.addEventListener("click", () => tts.pause());
btnResume.addEventListener("click", () => tts.resume());
btnStop.addEventListener("click", () => tts.stop());

btnLoadV2TTS.addEventListener("click", async () => {
  try {
    busyV2 = true;
    updateAllButtons();

    await aiTts.loadModel();
    v2StatusEl.textContent = "V2 Voice bereit.";

    if (latestScript.trim()) {
      btnGenerateAudio.disabled = false;
    }
  } catch (error) {
    console.error(error);
    v2StatusEl.textContent = `V2 Voice konnte nicht geladen werden: ${String(error?.message || error)}`;
  } finally {
    busyV2 = false;
    updateAllButtons();
  }
});

btnGenerateAudio.addEventListener("click", async () => {
  if (!latestScript.trim()) {
    v2StatusEl.textContent = "Bitte zuerst ein Skript erzeugen.";
    return;
  }

  try {
    busyV2 = true;
    latestWavBlob = null;
    updateAllButtons();

    const out = await aiTts.generateAudio(latestScript);
    latestWavBlob = float32ToWavBlob(out.audio, out.sampling_rate);
    attachBlobToAudioPlayer(audioPlayer, latestWavBlob);

    v2StatusEl.textContent = "V2 Audio erzeugt. Player und Download sind bereit.";
  } catch (error) {
    console.error(error);
    latestWavBlob = null;
    v2StatusEl.textContent = `V2 Audiofehler: ${String(error?.message || error)}`;
  } finally {
    busyV2 = false;
    updateAllButtons();
  }
});

btnDownloadWav.addEventListener("click", () => {
  if (!latestWavBlob) return;
  downloadBlob(latestWavBlob, "promptrebel-podcast-v2.wav");
});

function initPage() {
  updateCharCount();
  tts.init();
  updateAllButtons();
}

initPage();
