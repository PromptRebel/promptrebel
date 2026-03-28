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
let currentAudioUrl = null;

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

function revokeCurrentAudioUrl() {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

function resetV2AudioState() {
  latestWavBlob = null;

  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
  }

  revokeCurrentAudioUrl();
  btnDownloadWav.disabled = true;
}

function normalizeAudio(audio) {
  if (!audio) {
    throw new Error("Audio fehlt.");
  }

  let normalized = audio;

  // Falls das Modell ein normales Array oder verschachtelte Arrays liefert
  if (Array.isArray(normalized)) {
    normalized = normalized.flat(Infinity);
  }

  // Falls TypedArray, aber nicht Float32Array
  if (ArrayBuffer.isView(normalized) && !(normalized instanceof Float32Array)) {
    normalized = new Float32Array(normalized);
  }

  // Falls normales Array
  if (!(normalized instanceof Float32Array)) {
    normalized = new Float32Array(normalized);
  }

  if (!normalized.length) {
    throw new Error("Audio leer oder ungültig.");
  }

  // Sicherheits-Padding für problematische Längen
  const remainder = normalized.length % 4;
  if (remainder !== 0) {
    const padded = new Float32Array(normalized.length + (4 - remainder));
    padded.set(normalized);
    normalized = padded;
  }

  return normalized;
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
    resetV2AudioState();
    updateAllButtons();

    v2StatusEl.textContent = "V2 Audio wird erzeugt ...";

    const out = await aiTts.generateAudio(latestScript);

    if (!out?.audio) {
      throw new Error("Audio fehlt in der Modellantwort.");
    }

    if (!out?.sampling_rate) {
      throw new Error("Sampling-Rate fehlt in der Modellantwort.");
    }

    const cleanAudio = normalizeAudio(out.audio);
    latestWavBlob = float32ToWavBlob(cleanAudio, out.sampling_rate);

    currentAudioUrl = attachBlobToAudioPlayer(audioPlayer, latestWavBlob);

    v2StatusEl.textContent = "V2 Audio erzeugt. Player und Download sind bereit.";
  } catch (error) {
    console.error(error);
    latestWavBlob = null;
    revokeCurrentAudioUrl();
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
