// ui.js

let isMovingCamera = false;
let hasMoved = false; 
let lastX, lastY;
let startX, startY;

const btnWood = document.getElementById('btn-wood');
const btnStop = document.getElementById('btn-stop');
const btnHouse = document.getElementById('btn-house');
const btnLodge = document.getElementById('btn-lodge');
const actionMenu = document.getElementById('action-menu');
const placementControls = document.getElementById('placement-controls');

// Berechnet Welt-Koordinaten unter Berücksichtigung von Zoom/Skalierung und Kamera
function getCoords(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Skalierung berechnen (Interne 800px vs. tatsächliche Breite auf dem Screen)
    const scaleX = Renderer.canvas.width / rect.width;
    const scaleY = Renderer.canvas.height / rect.height;

    return {
        mx: (clientX - rect.left) * scaleX + GameState.camera.x,
        my: (clientY - rect.top) * scaleY + GameState.camera.y,
        screenX: clientX,
        screenY: clientY
    };
}

function handleStart(e) {
    const coords = getCoords(e);
    lastX = coords.screenX;
    lastY = coords.screenY;
    startX = coords.screenX;
    startY = coords.screenY;
    
    isMovingCamera = true; 
    hasMoved = false; 
}

function handleMove(e) {
    if (isMovingCamera) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - lastX;
        const dy = clientY - lastY;

        // Wenn Bewegung > 5 Pixel, gilt es als Scroll, nicht als Klick
        if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) {
            hasMoved = true;
        }

        GameState.camera.x -= dx;
        GameState.camera.y -= dy;

        // Grenzen der Welt einhalten
        GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
        GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

        lastX = clientX;
        lastY = clientY;
        
        if(e.cancelable) e.preventDefault();
    }

    // Falls im Placement-Mode: Vorschau dem Finger folgen lassen
    if (GameState.placementMode.active) {
        const coords = getCoords(e);
        GameState.placementMode.x = coords.mx;
        GameState.placementMode.y = coords.my;
    }
}

function handleEnd(e) {
    // Nur wenn nicht gescrollt wurde, verarbeiten wir einen Klick
    if (!hasMoved) {
        processClick(e);
    }
    isMovingCamera = false;
}

function processClick(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) || startX;
    const clientY = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) || startY;
    
    const scaleX = Renderer.canvas.width / rect.width;
    const scaleY = Renderer.canvas.height / rect.height;
    
    const mx = (clientX - rect.left) * scaleX + GameState.camera.x;
    const my = (clientY - rect.top) * scaleY + GameState.camera.y;

    // 1. Placement Mode Klick (Position setzen)
    if (GameState.placementMode.active) {
        GameState.placementMode.x = mx;
        GameState.placementMode.y = my;
        return;
    }

    // 2. HQ / Town Center Klick
    const tc = GameState.entities.townCenter;
    if (Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2) < 40) {
        spawnVillager();
        return;
    }

    // 3. Gebäude Klick (z.B. Zuweisen zum Forsthaus)
    let clickedB = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 25 && Math.abs(my - b.y) < 25);
    if (clickedB && clickedB.type === 'lodge' && clickedB.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedB; 
        GameState.selection.state = VillagerState.PLANTING; 
        return;
    }

    // 4. Villager Klick oder Abwählen (Bodenklick)
    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 30);
    if (foundV) {
        GameState.selection = foundV;
        actionMenu.style.display = 'block';
    } else {
        // Klick auf leeren Boden -> Auswahl aufheben
        GameState.selection = null;
        actionMenu.style.display = 'none';
    }
}

// Event-Listener für Maus und Touch registrieren
Renderer.canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

Renderer.canvas.addEventListener('touchstart', (e) => { handleStart(e); }, {passive: false});
window.addEventListener('touchmove', (e) => { handleMove(e); }, {passive: false});
window.addEventListener('touchend', (e) => { handleEnd(e); });

// Kontextmenü (Rechtsklick) am PC unterdrücken
Renderer.canvas.oncontextmenu = (e) => e.preventDefault();

// --- Button Funktionalitäten ---

btnWood.onclick = (e) => {
    e.stopPropagation();
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = false;
        GameState.selection.findNextTree();
    }
};

btnStop.onclick = (e) => {
    e.stopPropagation();
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = true;
        if(GameState.selection.inventory === 0) GameState.selection.state = VillagerState.IDLE;
    }
};

btnHouse.onclick = (e) => { e.stopPropagation(); startPlacement('house', GameState.config.costs.house); };
btnLodge.onclick = (e) => { e.stopPropagation(); startPlacement('lodge', GameState.config.costs.lodge); };

function startPlacement(type, cost) {
    if (GameState.selection && GameState.resources.wood >= cost) {
        GameState.placementMode = { 
            active: true, 
            type: type, 
            cost: cost, 
            x: GameState.camera.x + 400, 
            y: GameState.camera.y + 300 
        };
        placementControls.style.display = 'block';
        actionMenu.style.display = 'none';
    } else {
        alert("Nicht genug Holz!");
    }
}

document.getElementById('btn-confirm-build').onclick = (e) => {
    e.stopPropagation();
    const p = GameState.placementMode;
    GameState.resources.wood -= p.cost;
    const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
    GameState.entities.buildings.push(b);
    GameState.selection.targetBuilding = b;
    GameState.selection.state = VillagerState.BUILDING;
    cancelPlacement();
};

document.getElementById('btn-cancel-build').onclick = (e) => { e.stopPropagation(); cancelPlacement(); };

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
    } else {
        alert("Baue mehr Häuser!");
    }
}
