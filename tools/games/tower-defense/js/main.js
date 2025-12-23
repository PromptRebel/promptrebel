// js/main.js
import { loadAssets } from "./assets.js";
import { startGame } from "./game.js";

(async function boot(){
  const canvas = document.getElementById("canvas");
  const assets = await loadAssets();

  // Startet dein Spiel (game.js muss startGame exportieren)
  startGame({ canvas, assets });
})();
