let isMovingCamera = false;
let lastX, lastY;

Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    // WICHTIG: Welt-Koordinaten (Screen + Kamera)
    const mx = e.clientX - rect.left + GameState.camera.x;
    const my = e.clientY - rect.top + GameState.camera.y;

    lastX = e.clientX;
    lastY = e.clientY;

    // 1. Prüfen, ob wir ein Objekt treffen (Villager, Gebäude, Bäume)
    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 30);
    const tc = GameState.entities.townCenter;
    let clickedB = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 25 && Math.abs(my - b.y) < 25);
    let isHQ = Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2) < 40;

    // 2. Wenn wir NICHTS anklicken (Boden), dann Kamera bewegen aktivieren
    if (!foundV && !clickedB && !isHQ && !GameState.placementMode.active) {
        isMovingCamera = true;
    }

    // --- Logik für Aktionen (bleibt gleich) ---
    if (isHQ) { spawnVillager(); return; }
    
    if (clickedB && clickedB.type === 'lodge' && clickedB.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedB; 
        GameState.selection.state = VillagerState.PLANTING; 
        return;
    }

    if (foundV) { 
        GameState.selection = foundV; 
        document.getElementById('action-menu').style.display = 'block'; 
    } else { 
        // Nur abwählen, wenn wir nicht gerade die Kamera starten
        if (!isMovingCamera) {
            GameState.selection = null; 
            document.getElementById('action-menu').style.display = 'none'; 
        }
    }
});

// Die Bewegung muss auf dem ganzen Fenster (window) gehört werden, damit sie nicht abreißt
window.addEventListener('mousemove', (e) => {
    if (isMovingCamera) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        GameState.camera.x -= dx;
        GameState.camera.y -= dy;

        // Grenzen der Welt (2000x2000) einhalten
        GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
        GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

        lastX = e.clientX;
        lastY = e.clientY;
    }
});

window.addEventListener('mouseup', () => {
    isMovingCamera = false;
});

// --- Button Logik & Hilfsfunktionen (bleiben gleich) ---
document.getElementById('btn-wood').onclick = () => { if(GameState.selection) { GameState.selection.isQueuedForIdle = false; GameState.selection.findNextTree(); }};
document.getElementById('btn-stop').onclick = () => { if(GameState.selection) { GameState.selection.isQueuedForIdle = true; if(GameState.selection.inventory === 0) GameState.selection.state = VillagerState.IDLE; }};
document.getElementById('btn-house').onclick = () => startPlacement('house', GameState.config.costs.house);
document.getElementById('btn-lodge').onclick = () => startPlacement('lodge', GameState.config.costs.lodge);

function startPlacement(type, cost) {
    if (GameState.selection && GameState.resources.wood >= cost) {
        GameState.placementMode = { active: true, type, cost, x: GameState.camera.x + 400, y: GameState.camera.y + 300 };
        document.getElementById('placement-controls').style.display = 'block';
        document.getElementById('action-menu').style.display = 'none';
    }
}

document.getElementById('btn-confirm-build').onclick = () => {
    const p = GameState.placementMode; GameState.resources.wood -= p.cost;
    const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
    GameState.entities.buildings.push(b); GameState.selection.targetBuilding = b; GameState.selection.state = VillagerState.BUILDING;
    cancelPlacement();
};

document.getElementById('btn-cancel-build').onclick = cancelPlacement;
function cancelPlacement() { GameState.placementMode.active = false; document.getElementById('placement-controls').style.display = 'none'; }

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.getMaxPop()) {
        const tc = GameState.entities.townCenter; const angle = Math.random() * Math.PI * 2;
        const v = new Villager(tc.x + Math.cos(angle)*60, tc.y + Math.sin(angle)*60, Date.now());
        GameState.entities.villagers.push(v);
    }
}
