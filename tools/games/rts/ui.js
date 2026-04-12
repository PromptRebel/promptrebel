let isMovingCamera = false;
let lastX, lastY;

// Hilfsfunktion für die Koordinaten-Berechnung (wichtig für Touch!)
function getCoords(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        mx: clientX - rect.left + GameState.camera.x,
        my: clientY - rect.top + GameState.camera.y,
        screenX: clientX,
        screenY: clientY
    };
}

// START: Klick oder Touch
function handleStart(e) {
    const coords = getCoords(e);
    lastX = coords.screenX;
    lastY = coords.screenY;

    // Objekte prüfen
    let foundV = GameState.entities.villagers.find(v => Math.sqrt((coords.mx - v.x)**2 + (coords.my - v.y)**2) < 30);
    const tc = GameState.entities.townCenter;
    let clickedB = GameState.entities.buildings.find(b => Math.abs(coords.mx - b.x) < 25 && Math.abs(coords.my - b.y) < 25);
    let isHQ = Math.sqrt((coords.mx - tc.x)**2 + (coords.my - tc.y)**2) < 40;

    // Wenn Boden -> Kamera-Modus an
    if (!foundV && !clickedB && !isHQ && !GameState.placementMode.active) {
        isMovingCamera = true;
    }

    // Aktionen
    if (isHQ) { spawnVillager(); return; }
    
    if (clickedB && clickedB.type === 'lodge' && clickedB.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedB; 
        GameState.selection.state = VillagerState.PLANTING; 
        return;
    }

    if (foundV) { 
        GameState.selection = foundV; 
        document.getElementById('action-menu').style.display = 'block'; 
    } else if (!isMovingCamera) {
        GameState.selection = null; 
        document.getElementById('action-menu').style.display = 'none'; 
    }
}

// BEWEGUNG: Maus schieben oder Finger wischen
function handleMove(e) {
    if (isMovingCamera) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - lastX;
        const dy = clientY - lastY;

        GameState.camera.x -= dx;
        GameState.camera.y -= dy;

        // Grenzen
        GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
        GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

        lastX = clientX;
        lastY = clientY;
        
        // Verhindert das Scrollen der ganzen Webseite am Handy während man im Spiel wischt
        if(e.cancelable) e.preventDefault();
    }
    
    // Placement-Vorschau verschieben
    if (GameState.placementMode.active && e.touches) {
        const coords = getCoords(e);
        GameState.placementMode.x = coords.mx;
        GameState.placementMode.y = coords.my;
    }
}

// ENDE
function handleEnd() {
    isMovingCamera = false;
}

// Event Listener für Maus
Renderer.canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// Event Listener für Touch (Handy)
Renderer.canvas.addEventListener('touchstart', (e) => { handleStart(e); }, {passive: false});
window.addEventListener('touchmove', (e) => { handleMove(e); }, {passive: false});
window.addEventListener('touchend', handleEnd);

// Rechtsklick verhindern
Renderer.canvas.oncontextmenu = (e) => e.preventDefault();

// --- BUTTONS ---
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
