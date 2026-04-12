import { loadAssets } from './assets.js';

/**
 * Die zentrale Initialisierungs-Funktion.
 * Da loadAssets asynchron ist, muss init ebenfalls async sein.
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

    } catch (error) {
        // Wenn ein Bild fehlt (404), wird das hier auf dem Handy ausgegeben
        console.error("Fehler beim Laden der Assets:", error);
        alert("Ladefehler: " + error.message + "\nPrüfe die Pfade im assets-Ordner!");
    }

    // 2. Welt generieren: 100 Bäume zufällig verteilen
    // Wir stellen sicher, dass die Liste leer ist, bevor wir füllen
    GameState.entities.trees = []; 
    for (let i = 0; i < 100; i++) {
        GameState.entities.trees.push({
            x: Math.random() * (GameState.world.width - 100) + 50,
            y: Math.random() * (GameState.world.height - 100) + 50,
            woodAmount: GameState.config.treeWoodAmount
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
