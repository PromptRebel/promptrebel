// js/main.js
import { loadAssets } from "./assets.js";
import { startGame } from "./game.js";

(async function boot() {
  const canvas = document.getElementById("canvas");
  if (!canvas) throw new Error("#canvas missing");

  const assets = await loadAssets();

  // WICHTIG: game-API speichern!
  const game = await startGame({ canvas, assets });

  setInterval(syncSpellButton, 120);

  const btnSpells = document.getElementById("btnSpells");
  const overlay = document.getElementById("spellsOverlay");
  const closeSpells = document.getElementById("closeSpells");
  const spellOverdrive = document.getElementById("spellOverdrive");
const SPELL_COST = 500;

function syncSpellButton() {
  if (!game) return;

  const canBuy = game.getGold() >= SPELL_COST;

  spellOverdrive.disabled = !canBuy;
  spellOverdrive.classList.toggle("can-buy", canBuy);
}

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
  if (!game) return;

  const ok = game.castSpell("overdrive");
  if (!ok) return; // z.B. Gold inzwischen weg

  overlay.classList.add("hidden");
});
})();
