// main.js ganz oben hinzufügen
import { GameState } from './gamestate.js';
import { Renderer } from './renderer.js';


import { loadAssets } from './assets.js';

/**
 * Die zentrale Initialisierungs-Funktion.
 * Erweitert um das Stein-Vorkommen.
 */
async function init() {
    console.log("Initialisiere Spiel...");

    try {
        // 1. Assets laden (Bilder)
        // Das Ergebnis wird direkt in das Renderer-Objekt geschoben
        const assets = await loadAssets();
        Renderer.assets = assets;
        
        console.log("Assets erfolgreich geladen:", assets);

        // Sicherheitscheck für das Handy:
        if (!assets.props || !assets.props.tree) {
            console.warn("Baum-Grafik wurde nicht im Assets-Objekt gefunden.");
        }
        if (!assets.props || !assets.props.stone) {
            console.warn("Stein-Grafik wurde nicht im Assets-Objekt gefunden.");
        }

    } catch (error) {
        // Wenn ein Bild fehlt (404), wird das hier auf dem Handy ausgegeben
        console.error("Fehler beim Laden der Assets:", error);
        alert("Ladefehler: " + error.message + "\nPrüfe die Pfade im assets-Ordner!");
    }

    // 2a. Welt generieren: 80 Bäume zufällig verteilen
    GameState.entities.trees = []; 
    for (let i = 0; i < 80; i++) {
        GameState.entities.trees.push({
            x: Math.random() * (GameState.world.width - 100) + 50,
            y: Math.random() * (GameState.world.height - 100) + 50,
            woodAmount: GameState.config.treeWoodAmount
        });
    }

    // 2b. Welt generieren: 15 Steine zufällig verteilen (Neu)
    GameState.entities.stones = [];
    for (let i = 0; i < 15; i++) {
        GameState.entities.stones.push({
            x: Math.random() * (GameState.world.width - 200) + 100,
            y: Math.random() * (GameState.world.height - 200) + 100,
            stoneAmount: GameState.config.stoneAmount
        });
    }

    // 3. Game Loop starten
    requestAnimationFrame(gameLoop);
}

/**
 * Der Herzschlag des Spiels.
 * Wird ca. 60 Mal pro Sekunde aufgerufen.
 */
function gameLoop() {
    // Logik-Update für jeden Villager
    GameState.entities.villagers.forEach(v => {
        if (v && typeof v.update === 'function') {
            v.update();
        }
    });

    // Alles auf den Canvas zeichnen
    Renderer.draw();

    // Nächsten Frame anfordern
    requestAnimationFrame(gameLoop);
}

// Kickoff: Starte den asynchronen Prozess
init();
