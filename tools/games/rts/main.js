function init() {
    // 100 Bäume zufällig in der 2000x2000 Welt verteilen
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
init();
