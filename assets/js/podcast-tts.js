export class PodcastTTS {
  constructor({ voiceSelectId, statusId }) {
    this.synth = window.speechSynthesis;
    this.voiceSelect = document.getElementById(voiceSelectId);
    this.statusEl = document.getElementById(statusId);
    this.voices = [];
    this.currentUtterance = null;
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  loadVoices() {
    this.voices = this.synth.getVoices();

    if (!this.voiceSelect) return;

    this.voiceSelect.innerHTML = "";

    const germanVoices = this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("de"));
    const finalVoices = germanVoices.length ? germanVoices : this.voices;

    finalVoices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      if (index === 0) option.selected = true;
      this.voiceSelect.appendChild(option);
    });

    if (finalVoices.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Keine Stimme gefunden";
      this.voiceSelect.appendChild(option);
    }
  }

  init() {
    if (!("speechSynthesis" in window)) {
      this.setStatus("Dieser Browser unterstützt keine Sprachsynthese.");
      return false;
    }

    this.loadVoices();

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }

    return true;
  }

  speak(text) {
    if (!text || !text.trim()) return;

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    const selectedVoiceName = this.voiceSelect?.value;
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
    utterance.onend = () => this.setStatus("Wiedergabe beendet.");
    utterance.onerror = () => this.setStatus("Fehler bei der Sprachwiedergabe.");

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  pause() {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.setStatus("Wiedergabe pausiert.");
    }
  }

  resume() {
    if (this.synth.paused) {
      this.synth.resume();
      this.setStatus("Wiedergabe fortgesetzt.");
    }
  }

  stop() {
    this.synth.cancel();
    this.setStatus("Wiedergabe gestoppt.");
  }
}
