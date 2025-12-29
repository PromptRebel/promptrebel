// js/main.js
import { loadAssets } from "./assets.js";
import { startGame } from "./game.js";

(async function boot(){
  const canvas = document.getElementById("canvas");
  const assets = await loadAssets();

  // Startet dein Spiel (game.js muss startGame exportieren)
  startGame({ canvas, assets });
})();
const btnSpells = document.getElementById("btnSpells");
const overlay = document.getElementById("spellsOverlay");
const closeSpells = document.getElementById("closeSpells");
const spellOverdrive = document.getElementById("spellOverdrive");

btnSpells.addEventListener("click", () => {
  overlay.classList.remove("hidden");
});

closeSpells.addEventListener("click", () => {
  overlay.classList.add("hidden");
});

// WICHTIG: Hier rufst du deine Game-Logik auf
spellOverdrive.addEventListener("click", () => {
  // Variante A: direkter State Zugriff
  // castOverdrive(state);

  // Variante B: sauberer über Game-API:
  // game.castSpell("overdrive");

  overlay.classList.add("hidden");
});
