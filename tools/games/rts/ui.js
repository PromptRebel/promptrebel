const actionMenu = document.getElementById('action-menu');
const placementControls = document.getElementById('placement-controls');

Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;

    if (GameState.placementMode.active) {
        GameState.placementMode.x = mx;
        GameState.placementMode.y = my;
        return;
    }

    const tc = GameState.entities.townCenter;
    if (Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2) < 40) { spawnVillager(); return; }

    let clickedBuilding = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 25 && Math.abs(my - b.y) < 25);
    if (clickedBuilding && clickedBuilding.type === 'lodge' && clickedBuilding.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedBuilding;
        GameState.selection.state = VillagerState.PLANTING;
        return;
    }

    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 30);
    if (foundV) {
        GameState.selection = foundV;
        actionMenu.style.display = 'block';
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none';
    }
});

document.getElementById('btn-wood').onclick = () => { if(GameState.selection) { GameState.selection.isQueuedForIdle = false; GameState.selection.findNextTree(); }};
document.getElementById('btn-stop').onclick = () => { if(GameState.selection) { GameState.selection.isQueuedForIdle = true; if(GameState.selection.inventory === 0) GameState.selection.state = VillagerState.IDLE; }};
document.getElementById('btn-house').onclick = () => startPlacement('house', GameState.config.costs.house);
document.getElementById('btn-lodge').onclick = () => startPlacement('lodge', GameState.config.costs.lodge);

function startPlacement(type, cost) {
    if (GameState.selection && GameState.resources.wood >= cost) {
        GameState.placementMode = { active: true, type, cost, x: 400, y: 300 };
        placementControls.style.display = 'block';
        actionMenu.style.display = 'none';
    } else { alert("Nicht genug Holz!"); }
}

document.getElementById('btn-confirm-build').onclick = () => {
    const p = GameState.placementMode;
    GameState.resources.wood -= p.cost;
    const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
    GameState.entities.buildings.push(b);
    GameState.selection.targetBuilding = b;
    GameState.selection.state = VillagerState.BUILDING;
    cancelPlacement();
};

document.getElementById('btn-cancel-build').onclick = cancelPlacement;

function cancelPlacement() {
    GameState.placementMode.active = false;
    placementControls.style.display = 'none';
}

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.getMaxPop()) {
        const tc = GameState.entities.townCenter;
        const angle = Math.random() * Math.PI * 2;
        const v = new Villager(tc.x + Math.cos(angle)*60, tc.y + Math.sin(angle)*60, Date.now());
        GameState.entities.villagers.push(v);
    }
}
