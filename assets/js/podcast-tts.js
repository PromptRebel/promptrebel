// assets/js/podcast-tts.js
export class PodcastTTS {
  constructor({ voiceSelectId, statusId }) {
    this.synth = window.speechSynthesis;
    this.voiceSelect = document.getElementById(voiceSelectId);
    this.statusEl = document.getElementById(statusId);
    this.voices = [];
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  hasSupport() {
    return "speechSynthesis" in window;
  }

  populateVoices() {
    if (!this.voiceSelect) return;

    const voices = this.synth.getVoices();
    this.voices = voices;
    this.voiceSelect.innerHTML = "";

    if (!voices.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Keine Stimme gefunden";
      this.voiceSelect.appendChild(option);
      this.voiceSelect.disabled = true;
      return;
    }

    const germanVoices = voices.filter(v => v.lang?.toLowerCase().startsWith("de"));
    const finalVoices = germanVoices.length ? germanVoices : voices;

    finalVoices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      if (index === 0) option.selected = true;
      this.voiceSelect.appendChild(option);
    });

    this.voiceSelect.disabled = false;
  }

  init() {
    if (!this.hasSupport()) {
      this.setStatus("Dieser Browser unterstützt keine Sprachsynthese.");
      return false;
    }

    this.populateVoices();

    if (typeof speechSynthesis.onvoiceschanged !== "undefined") {
      speechSynthesis.onvoiceschanged = () => this.populateVoices();
    }

    return true;
  }

  speak(text) {
    if (!text?.trim()) {
      this.setStatus("Kein Text zum Vorlesen vorhanden.");
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    const selectedVoiceName = this.voiceSelect?.value || "";
    const selectedVoice = this.voices.find(v => v.name === selectedVoiceName);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "de-DE";
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => this.setStatus("Wiedergabe läuft...");
    utterance.onpause = () => this.setStatus("Wiedergabe pausiert.");
    utterance.onresume = () => this.setStatus("Wiedergabe fortgesetzt.");
    utterance.onend = () => this.setStatus("Wiedergabe beendet.");
    utterance.onerror = () => this.setStatus("Fehler bei der Sprachwiedergabe.");

    this.synth.speak(utterance);
  }

  pause() {
    if (this.synth.speaking && !this.synth.paused) this.synth.pause();
  }

  resume() {
    if (this.synth.paused) this.synth.resume();
  }

  stop() {
    this.synth.cancel();
  }
}
