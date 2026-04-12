// ui.js - Vollständige Version
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

/**
 * Berechnet die exakten Welt-Koordinaten.
 * Berücksichtigt: Canvas-Position im DOM, Skalierung durch CSS (Vollbild) 
 * und die aktuelle Kamera-Position.
 */
function getCoords(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
    // WICHTIG: Skalierungsfaktor zwischen internen 800x600 und CSS-Anzeige
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
        const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;

        const dx = clientX - lastX;
        const dy = clientY - lastY;

        // Wenn Bewegung > 8 Pixel, ist es ein Scroll, kein Klick
        if (Math.abs(clientX - startX) > 8 || Math.abs(clientY - startY) > 8) {
            hasMoved = true;
            // Verhindert das "Ziehen" der Webseite am Handy
            if (e.cancelable) e.preventDefault();
        }

        GameState.camera.x -= dx;
        GameState.camera.y -= dy;

        // Grenzen der 2000x2000 Welt einhalten
        GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
        GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

        lastX = clientX;
        lastY = clientY;
    }

    // Wenn wir ein Gebäude platzieren, folgt die Vorschau dem Finger
    if (GameState.placementMode.active) {
        const coords = getCoords(e);
        GameState.placementMode.x = coords.mx;
        GameState.placementMode.y = coords.my;
    }
}

function handleEnd(e) {
    // Nur wenn nicht gescrollt wurde, werten wir es als Klick aus
    if (!hasMoved) {
        processClick(e);
    }
    isMovingCamera = false;
}

function processClick(e) {
    // Koordinaten vom Startpunkt des Klicks (präziser auf Mobile)
    const rect = Renderer.canvas.getBoundingClientRect();
    const scaleX = Renderer.canvas.width / rect.width;
    const scaleY = Renderer.canvas.height / rect.height;
    
    const mx = (startX - rect.left) * scaleX + GameState.camera.x;
    const my = (startY - rect.top) * scaleY + GameState.camera.y;

    // 1. Placement Mode (Gebäude setzen)
    if (GameState.placementMode.active) {
        GameState.placementMode.x = mx;
        GameState.placementMode.y = my;
        return;
    }

    // 2. HQ / Dorfzentrum Klick (Spawnen)
    const tc = GameState.entities.townCenter;
    const distToTC = Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2);
    if (distToTC < 60) {
        spawnVillager();
        return;
    }

    // 3. Gebäude-Interaktion (z.B. Zuweisung zum Forsthaus)
    let clickedB = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 40 && Math.abs(my - b.y) < 40);
    if (clickedB && clickedB.type === 'lodge' && clickedB.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedB; 
        GameState.selection.state = VillagerState.PLANTING; 
        return;
    }

    // 4. Villager auswählen oder alles abwählen
    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 40);
    if (foundV) {
        GameState.selection = foundV;
        actionMenu.style.display = 'flex'; // Footer einblenden
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none'; // Footer ausblenden
    }
}

// --- EVENT REGISTRIERUNG ---

// Maus-Support
Renderer.canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// Touch-Support (Wichtig: passive: false für e.preventDefault())
Renderer.canvas.addEventListener('touchstart', (e) => {
    handleStart(e);
}, {passive: false});

window.addEventListener('touchmove', (e) => {
    handleMove(e);
}, {passive: false});

window.addEventListener('touchend', (e) => {
    handleEnd(e);
}, {passive: false});

// Verhindert das Kontextmenü (Rechtsklick)
Renderer.canvas.oncontextmenu = (e) => e.preventDefault();

// --- BUTTON AKTIONEN ---

btnWood.onclick = (e) => {
    e.stopPropagation();
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = false;
        GameState.selection.targetBuilding = null;
        GameState.selection.findNextTree();
    }
};

btnStop.onclick = (e) => {
    e.stopPropagation();
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = true;
        GameState.selection.state = VillagerState.IDLE;
    }
};

btnHouse.onclick = () => startPlacement('house', 50);
btnLodge.onclick = () => startPlacement('lodge', 100);

function startPlacement(type, cost) {
    if (GameState.resources.wood >= cost) {
        GameState.placementMode = { 
            active: true, 
            type: type, 
            cost: cost, 
            x: GameState.camera.x + 400, 
            y: GameState.camera.y + 300 
        };
        document.getElementById('placement-controls').style.display = 'flex';
        actionMenu.style.display = 'none';
    }
}

document.getElementById('btn-confirm-build').onclick = () => {
    const p = GameState.placementMode;
    GameState.resources.wood -= p.cost;
    const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
    GameState.entities.buildings.push(b);
    if(GameState.selection) {
        GameState.selection.targetBuilding = b;
        GameState.selection.state = VillagerState.BUILDING;
    }
    cancelPlacement();
};

document.getElementById('btn-cancel-build').onclick = cancelPlacement;

function cancelPlacement() {
    GameState.placementMode.active = false;
    document.getElementById('placement-controls').style.display = 'none';
}

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.getMaxPop()) {
        const tc = GameState.entities.townCenter;
        // Erstellen am HQ
        const v = new Villager(tc.x + 50, tc.y + 50, Date.now());
        GameState.entities.villagers.push(v);
    }
}
