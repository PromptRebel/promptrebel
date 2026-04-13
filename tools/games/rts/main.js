// main.js
import { GameState } from './gamestate.js';
import { Renderer } from './renderer.js';
import { loadAssets } from './assets.js';
import { Villager } from './villager.js';
import './ui.js'; // Importiert die UI-Logik und führt sie aus

/**
 * Die zentrale Initialisierungs-Funktion.
 * Lädt Assets und generiert die Start-Welt.
 */
async function init() {
    console.log("Initialisiere Spiel...");

    try {
        // 1. Assets laden (Bilder)
        const assets = await loadAssets();
        Renderer.assets = assets;
        
        console.log("Assets erfolgreich geladen:", assets);

        // Sicherheitscheck für die Grafiken
        if (!assets.props || !assets.props.tree) {
            console.warn("Baum-Grafik fehlt in assets.props");
        }
        if (!assets.props || !assets.props.stone) {
            console.warn("Stein-Grafik fehlt in assets.props");
        }

    } catch (error) {
        console.error("Fehler beim Laden der Assets:", error);
        alert("Ladefehler: " + error.message + "\nPrüfe die Pfade im assets-Ordner!");
    }

    // 2. Welt generieren
    
    // Bäume verteilen
    GameState.entities.trees = []; 
    for (let i = 0; i < 80; i++) {
        GameState.entities.trees.push({
            x: Math.random() * (GameState.world.width - 100) + 50,
            y: Math.random() * (GameState.world.height - 100) + 50,
            woodAmount: GameState.config.treeWoodAmount
        });
    }

    // Steine verteilen
    GameState.entities.stones = [];
    for (let i = 0; i < 15; i++) {
        GameState.entities.stones.push({
            x: Math.random() * (GameState.world.width - 200) + 100,
            y: Math.random() * (GameState.world.height - 200) + 100,
            stoneAmount: GameState.config.stoneAmount
        });
    }

    // Ersten Villager als Start-Einheit erstellen (optional)
    const tc = GameState.entities.townCenter;
    GameState.entities.villagers.push(new Villager(tc.x + 60, tc.y + 60, Date.now()));

    // 3. Game Loop starten
    requestAnimationFrame(gameLoop);
}

/**
 * Der Herzschlag des Spiels.
 * Wird ca. 60 Mal pro Sekunde aufgerufen.
 */
function gameLoop() {
    // Logik-Update für jeden Villager
    // Wir übergeben GameState direkt an die update-Methode
    GameState.entities.villagers.forEach(v => {
        if (v && typeof v.update === 'function') {
            v.update(GameState);
        }
    });

    // Alles auf den Canvas zeichnen
    Renderer.draw(GameState);

    // Nächsten Frame anfordern
    requestAnimationFrame(gameLoop);
}

// Kickoff: Starte den Prozess
init();
