import { PodcastLLM } from "./podcast-llm.js";
import { PodcastTTS } from "./podcast-tts.js";

const promptInput = document.getElementById("promptInput");
const promptCount = document.getElementById("promptCount");
const btnGenerate = document.getElementById("btnGenerate");
const btnSpeak = document.getElementById("btnSpeak");
const btnPause = document.getElementById("btnPause");
const btnResume = document.getElementById("btnResume");
const btnStop = document.getElementById("btnStop");
const outputText = document.getElementById("outputText");

const llm = new PodcastLLM({
  statusId: "status",
  outputId: "outputText",
});

const tts = new PodcastTTS({
  voiceSelectId: "voiceSelect",
  statusId: "status",
});

let latestScript = "";

function updateCharCount() {
  promptCount.textContent = `${promptInput.value.length} / 600`;
}

function setSpeakingButtons(enabled) {
  btnSpeak.disabled = !enabled;
  btnPause.disabled = !enabled;
  btnResume.disabled = !enabled;
  btnStop.disabled = !enabled;
}

promptInput.addEventListener("input", updateCharCount);

btnGenerate.addEventListener("click", async () => {
  try {
    btnGenerate.disabled = true;
    setSpeakingButtons(false);

    const prompt = promptInput.value.trim();
    if (!prompt) {
      document.getElementById("status").textContent = "Bitte zuerst ein Thema eingeben.";
      return;
    }

    latestScript = await llm.generate(prompt);
    outputText.textContent = latestScript;
    setSpeakingButtons(true);
  } catch (error) {
    console.error(error);
    document.getElementById("status").textContent = "Fehler bei der Skripterzeugung.";
  } finally {
    btnGenerate.disabled = false;
  }
});

btnSpeak.addEventListener("click", () => {
  if (!latestScript.trim()) return;
  tts.speak(latestScript);
});

btnPause.addEventListener("click", () => tts.pause());
btnResume.addEventListener("click", () => tts.resume());
btnStop.addEventListener("click", () => tts.stop());

async function initPage() {
  updateCharCount();
  tts.init();
  await llm.init();
}

initPage();
