function init() {
    // Erstelle Bäume mit Holz-Limit
    for (let i = 0; i < 20; i++) {
        GameState.entities.trees.push({
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50,
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

init();
