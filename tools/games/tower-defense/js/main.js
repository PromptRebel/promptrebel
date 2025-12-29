// js/main.js
import { loadAssets } from "./assets.js";
import { startGame } from "./game.js";

(async function boot() {
  const canvas = document.getElementById("canvas");
  if (!canvas) throw new Error("#canvas missing");

  const assets = await loadAssets();

  // WICHTIG: game-API speichern!
  const game = await startGame({ canvas, assets });

  const btnSpells = document.getElementById("btnSpells");
  const overlay = document.getElementById("spellsOverlay");
  const closeSpells = document.getElementById("closeSpells");
  const spellOverdrive = document.getElementById("spellOverdrive");

  if (!btnSpells || !overlay || !closeSpells || !spellOverdrive) {
    console.warn("Spell UI elements missing in DOM");
    return;
  }

  btnSpells.addEventListener("click", () => {
    overlay.classList.remove("hidden");
  });

  closeSpells.addEventListener("click", () => {
    overlay.classList.add("hidden");
  });

  spellOverdrive.addEventListener("click", () => {
    // Variante B: sauber über Game-API:
    game.castSpell("overdrive");
    overlay.classList.add("hidden");
  });
})();
