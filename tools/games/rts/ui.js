let isMovingCamera = false;
let hasMoved = false; 
let lastX, lastY;
let startX, startY;

const actionMenu = document.getElementById('action-menu');
const placementControls = document.getElementById('placement-controls');

function getCoords(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
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

        if (Math.abs(clientX - startX) > 15 || Math.abs(clientY - startY) > 15) {
            hasMoved = true;
            if (e.cancelable) e.preventDefault();
        }

        GameState.camera.x -= dx;
        GameState.camera.y -= dy;

        GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
        GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

        lastX = clientX;
        lastY = clientY;
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
    const clientX = startX;
    const clientY = startY;
    
    const scaleX = Renderer.canvas.width / rect.width;
    const scaleY = Renderer.canvas.height / rect.height;
    
    const mx = (clientX - rect.left) * scaleX + GameState.camera.x;
    const my = (clientY - rect.top) * scaleY + GameState.camera.y;

    // DEBUG
    const tc = GameState.entities.townCenter;
    const dist = Math.round(Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2));
    document.getElementById('debug').innerHTML = 
        `Klick: ${Math.round(mx)} / ${Math.round(my)}<br>
         HQ: ${tc.x} / ${tc.y}<br>
         Dist: ${dist}<br>
         Pop: ${GameState.entities.villagers.length} / ${GameState.getMaxPop()}`;

    if (GameState.placementMode.active) {
        GameState.placementMode.x = mx;
        GameState.placementMode.y = my;
        return;
    }

    // Rechteck-Check statt Kreis
    if (mx >= tc.x - 25 && mx <= tc.x + 25 && my >= tc.y - 25 && my <= tc.y + 25) {
        spawnVillager();
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

Renderer.canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

Renderer.canvas.addEventListener('touchstart', (e) => { handleStart(e); }, {passive: false});
window.addEventListener('touchmove', (e) => { handleMove(e); }, {passive: false});
window.addEventListener('touchend', (e) => { handleEnd(e); }, {passive: false});

document.getElementById('btn-wood').onclick = function(e) {
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = false;
        GameState.selection.targetBuilding = null;
        GameState.selection.findNextTree();
    }
};

document.getElementById('btn-stop').onclick = function() {
    if(GameState.selection) {
        GameState.selection.isQueuedForIdle = true;
        if(GameState.selection.inventory === 0) GameState.selection.state = VillagerState.IDLE;
    }
};

document.getElementById('btn-house').onclick = function() { startPlacement('house', GameState.config.costs.house); };
document.getElementById('btn-lodge').onclick = function() { startPlacement('lodge', GameState.config.costs.lodge); };

function startPlacement(type, cost) {
    if (GameState.selection && GameState.resources.wood >= cost) {
        GameState.placementMode = { active: true, type, cost, x: GameState.camera.x + 400, y: GameState.camera.y + 300 };
        placementControls.style.display = 'block';
        actionMenu.style.display = 'none';
    }
}

document.getElementById('btn-confirm-build').onclick = function() {
    const p = GameState.placementMode;
    GameState.resources.wood -= p.cost;
    const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
    GameState.entities.buildings.push(b);
    GameState.selection.targetBuilding = b;
    GameState.selection.state = VillagerState.BUILDING;
    cancelPlacement();
};

document.getElementById('btn-cancel-build').onclick = cancelPlacement;
function cancelPlacement() { GameState.placementMode.active = false; placementControls.style.display = 'none'; }

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.getMaxPop()) {
        const tc = GameState.entities.townCenter;
        const v = new Villager(tc.x + 50, tc.y + 50, Date.now());
        GameState.entities.villagers.push(v);
    }
}
