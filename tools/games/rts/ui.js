// Klick-Erkennung
Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 1. Klick auf Dorfzentrum?
    const tc = GameState.entities.townCenter;
    if (Math.abs(mx - tc.x) < 25 && Math.abs(my - tc.y) < 25) {
        spawnVillager();
        return;
    }

    // 2. Klick auf Villager?
    let found = false;
    GameState.entities.villagers.forEach(v => {
        if (Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 15) {
            GameState.selection = v;
            found = true;
        }
    });
    if (!found) GameState.selection = null;
});

// Taste "H" für Holz fällen
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h' && GameState.selection) {
        // Nächsten Baum suchen
        const v = GameState.selection;
        let closestTree = GameState.entities.trees[0];
        let minDist = Infinity;

        GameState.entities.trees.forEach(t => {
            const d = Math.sqrt((t.x - v.x)**2 + (t.y - v.y)**2);
            if (d < minDist) {
                minDist = d;
                closestTree = t;
            }
        });

        v.targetTree = closestTree;
        v.state = VillagerState.MOVING_TO_TREE;
    }
});

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.config.maxVillagers) {
        const tc = GameState.entities.townCenter;
        const v = new Villager(tc.x + 40, tc.y + 40, Date.now());
        GameState.entities.villagers.push(v);
    }
}
