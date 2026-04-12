function init() {
    // 15 Bäume zufällig verteilen
    for (let i = 0; i < 15; i++) {
        GameState.entities.trees.push({
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50
        });
    }
    gameLoop();
}

function gameLoop() {
    // Logik-Update
    GameState.entities.villagers.forEach(v => v.update());
    
    // Zeichnen
    Renderer.draw();

    requestAnimationFrame(gameLoop);
}

init();
