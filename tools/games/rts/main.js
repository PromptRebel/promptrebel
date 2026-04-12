// Funktion zum Laden eines Bildes
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Asset missing: " + url));
    });
}

async function init() {
    console.log("Lade Assets...");
    try {
        // Pfad zu deinem Baum-Bild (z.B. im selben Ordner)
        const treeImg = await loadImage('tree.png');
        Renderer.assets.tree = treeImg;
        console.log("Baum geladen!");
    } catch (e) {
        console.error("Grafik konnte nicht geladen werden, nutze Fallback.", e);
    }

    // 100 Bäume zufällig verteilen
    for (let i = 0; i < 100; i++) {
        GameState.entities.trees.push({
            x: Math.random() * (GameState.world.width - 100) + 50,
            y: Math.random() * (GameState.world.height - 100) + 50,
            woodAmount: GameState.config.treeWoodAmount
        });
    }

    gameLoop();
}

function gameLoop() {
    GameState.entities.villagers.forEach(v => v.update());
    Renderer.draw();
    requestAnimationFrame(gameLoop);
}

// Start des Spiels
init();
