const actionMenu = document.getElementById('action-menu');

Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    // 1. Klick auf Gebäude (HQ oder andere)
    const tc = GameState.entities.townCenter;
    if (Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2) < 40) { spawnVillager(); return; }

    let clickedBuilding = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 25 && Math.abs(my - b.y) < 25);
    if (clickedBuilding && clickedBuilding.type === 'lodge' && clickedBuilding.isFinished && GameState.selection) {
        // Zuweisen als Förster
        GameState.selection.targetBuilding = clickedBuilding;
        GameState.selection.state = VillagerState.PLANTING;
        return;
    }

    // 2. Klick auf Villager
    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 30);
    if (foundV) {
        GameState.selection = foundV;
        actionMenu.style.display = 'block';
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none';
    }
});

// Button Events
document.getElementById('btn-wood').onclick = () => { if(GameState.selection) { GameState.selection.isQueuedForIdle = false; GameState.selection.findNextTree(); }};
document.getElementById('btn-stop').onclick = () => { if(GameState.selection) { GameState.selection.isQueuedForIdle = true; if(GameState.selection.inventory === 0) GameState.selection.state = VillagerState.IDLE; }};
document.getElementById('btn-house').onclick = () => { startBuild('house', GameState.config.costs.house); };
document.getElementById('btn-lodge').onclick = () => { startBuild('lodge', GameState.config.costs.lodge); };

function startBuild(type, cost) {
    if (GameState.selection && GameState.resources.wood >= cost) {
        GameState.resources.wood -= cost;
        const b = { x: GameState.selection.x + 40, y: GameState.selection.y, type: type, progress: 0, isFinished: false };
        GameState.entities.buildings.push(b);
        GameState.selection.targetBuilding = b;
        GameState.selection.state = VillagerState.BUILDING;
    }
}

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.getMaxPop()) {
        const tc = GameState.entities.townCenter;
        const angle = Math.random() * Math.PI * 2;
        const v = new Villager(tc.x + Math.cos(angle)*60, tc.y + Math.sin(angle)*60, Date.now());
        GameState.entities.villagers.push(v);
    }
}
