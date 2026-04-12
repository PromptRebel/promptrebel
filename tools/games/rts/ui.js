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

function getCoords(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
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
    // Falls es ein Touch-Event ist, verhindern wir das nachfolgende Mouse-Event
    if (e.type === 'touchstart') e.preventDefault();

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

        if (Math.abs(clientX - startX) > 10 || Math.abs(clientY - startY) > 10) {
            hasMoved = true;
        }

        GameState.camera.x -= dx;
        GameState.camera.y -= dy;

        GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
        GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

        lastX = clientX;
        lastY = clientY;
    }

    if (GameState.placementMode.active && e.touches) {
        const coords = getCoords(e);
        GameState.placementMode.x = coords.mx;
        GameState.placementMode.y = coords.my;
    }
}

function handleEnd(e) {
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

    if (GameState.placementMode.active) {
        GameState.placementMode.x = mx;
        GameState.placementMode.y = my;
        return;
    }

    const tc = GameState.entities.townCenter;
    if (Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2) < 50) {
        spawnVillager();
        return;
    }

    let clickedB = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 30 && Math.abs(my - b.y) < 30);
    if (clickedB && clickedB.type === 'lodge' && clickedB.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedB; 
        GameState.selection.state = VillagerState.PLANTING; 
        return;
    }

    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 35);
    if (foundV) {
        GameState.selection = foundV;
        actionMenu.style.display = 'block';
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none';
    }
}

// Event-Listener
Renderer.canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

Renderer.canvas.addEventListener('touchstart', handleStart, {passive: false});
window.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd, {passive: false});

Renderer.canvas.oncontextmenu = (e) => e.preventDefault();

// Button-Funktionen
btnWood.onclick = (e) => {
    e.preventDefault();
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = false;
        GameState.selection.findNextTree();
    }
};

btnStop.onclick = (e) => {
    e.preventDefault();
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = true;
        if(GameState.selection.inventory === 0) GameState.selection.state = VillagerState.IDLE;
    }
};

btnHouse.onclick = (e) => { e.preventDefault(); startPlacement('house', GameState.config.costs.house); };
btnLodge.onclick = (e) => { e.preventDefault(); startPlacement('lodge', GameState.config.costs.lodge); };

function startPlacement(type, cost) {
    if (GameState.selection && GameState.resources.wood >= cost) {
        GameState.placementMode = { active: true, type: type, cost: cost, x: GameState.camera.x + 400, y: GameState.camera.y + 300 };
        placementControls.style.display = 'block';
        actionMenu.style.display = 'none';
    }
}

document.getElementById('btn-confirm-build').onclick = (e) => {
    e.preventDefault();
    const p = GameState.placementMode;
    GameState.resources.wood -= p.cost;
    const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
    GameState.entities.buildings.push(b);
    GameState.selection.targetBuilding = b;
    GameState.selection.state = VillagerState.BUILDING;
    cancelPlacement();
};

document.getElementById('btn-cancel-build').onclick = (e) => { e.preventDefault(); cancelPlacement(); };

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
