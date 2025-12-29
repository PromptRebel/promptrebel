// js/assets.js
// Pixelart wird in der Praxis fast immer als PNG gespeichert (Sprite / Tiles).
// "Pixelig" wird's durch: imageSmoothingEnabled = false + integer scaling.

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Asset missing: " + url));
  });
}

export async function loadAssets() {
  const manifest = {
    tiles: {
      grass:        "assets/tiles/grass.png",
      pathStraight: "assets/tiles/path_straight.png",
      pathCorner:   "assets/tiles/path_corner.png",
      pathEnd:      "assets/tiles/path_end.png",
    },

    props: {
      tree:  "assets/props/tree.png",
      bush:  "assets/props/bush.png",
      rock:  "assets/props/rock.png",
      chest: "assets/props/chest.png",

      // Gates
      startGate: "assets/props/startGate.png",
      endGate:   "assets/props/endGate.png",
    },

    towers: {
      archer: "assets/towers/archer.png",
      cannon: "assets/towers/cannon.png",
      mage:   "assets/towers/mage.png",
    },

    // ENEMIES:
    // Du kannst hier entweder Single-PNGs ODER Spritesheets hinterlegen.
    // render.js entscheidet anhand von e.sprite (in game.js), ob ein Sheet genutzt wird.
    enemies: {
      // Base / legacy
      fast:     "assets/enemies/fast.png",
      tank:     "assets/enemies/tank.png",
      boss:     "assets/enemies/boss.png",

      // NEW (optional): wenn du separate Enemies willst
      minion:   "assets/enemies/minion.png",
      summoner: "assets/enemies/summoner.png",

      // OPTIONAL: falls du bewusst andere Dateien für Sheets nutzt:
      // fastSheet:     "assets/enemies/fast_sheet.png",
      // tankSheet:     "assets/enemies/tank_sheet.png",
      // bossSheet:     "assets/enemies/boss_sheet.png",
      // minionSheet:   "assets/enemies/minion_sheet.png",
      // summonerSheet: "assets/enemies/summoner_sheet.png",
    }
  };

  const out = { tiles: {}, props: {}, towers: {}, enemies: {} };

  // tolerant: wenn ein Asset fehlt -> null (Fallback in draw)
  for (const [group, entries] of Object.entries(manifest)) {
    for (const [key, url] of Object.entries(entries)) {
      try {
        out[group][key] = await loadImage(url);
      } catch (e) {
        console.warn(e.message);
        out[group][key] = null;
      }
    }
  }

  return out;
}
