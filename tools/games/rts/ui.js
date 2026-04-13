import { GameState } from './gamestate.js';
import { Renderer } from './renderer.js';
import { Villager } from './villager.js';

let isMovingCamera = false;
let hasMoved = false; 
let lastX, lastY;
let startX, startY;
let lastSpawnTime = 0; 

// UI Elemente
const btnWood = document.getElementById('btn-wood');
const btnStone = document.getElementById('btn-stone');
const btnStop = document.getElementById('btn-stop');
const btnHouse = document.getElementById('btn-house');
const btnLodge = document.getElementById('btn-lodge');
const actionMenu = document.getElementById('action-menu');
const placementControls = document.getElementById('placement-controls');

// Rechnet Screen-Koordinaten in Welt-Koordinaten um
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
    // Klick auf UI blockiert Welt-Interaktion
    if (e.target.tagName === 'BUTTON' || e.target.closest('#action-menu') || e.target.closest('#header')) return;

    const coords = getCoords(e);
    lastX = coords.screenX;
    lastY = coords.screenY;
    startX = coords.screenX;
    startY = coords.screenY;
    
    isMovingCamera = true; 
    hasMoved = false; 
}

function handleMove(e) {
    if (!isMovingCamera) return;

    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;

    const dx = clientX - lastX;
    const dy = clientY - lastY;

    if (Math.abs(clientX - startX) > 10 || Math.abs(clientY - startY) > 10) {
        hasMoved = true;
        if (e.cancelable) e.preventDefault();
    }

    GameState.camera.x -= dx;
    GameState.camera.y -= dy;

    // Grenzen einhalten
    GameState.camera.x = Math.max(0, Math.min(GameState.camera.x, GameState.world.width - Renderer.canvas.width));
    GameState.camera.y = Math.max(0, Math.min(GameState.camera.y, GameState.world.height - Renderer.canvas.height));

    lastX = clientX;
    lastY = clientY;
}

function handleEnd(e) {
    if (isMovingCamera && !hasMoved) {
        processClick(e);
    }
    isMovingCamera = false;
}

function processClick(e) {
    const rect = Renderer.canvas.getBoundingClientRect();
    const scaleX = Renderer.canvas.width / rect.width;
    const scaleY = Renderer.canvas.height / rect.height;
    
    const mx = (startX - rect.left) * scaleX + GameState.camera.x;
    const my = (startY - rect.top) * scaleY + GameState.camera.y;

    if (GameState.placementMode.active) {
        GameState.placementMode.x = mx;
        GameState.placementMode.y = my;
        return;
    }

    // TownCenter Klick -> Spawn
    const tc = GameState.entities.townCenter;
    const distToTC = Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2);
    if (distToTC < 60) {
        spawnVillager();
        return;
    }

    // Gebäude Klick (Lodge Zuweisung)
    let clickedB = GameState.entities.buildings.find(b => Math.abs(mx - b.x) < 40 && Math.abs(my - b.y) < 40);
    if (clickedB && clickedB.type === 'lodge' && clickedB.isFinished && GameState.selection) {
        GameState.selection.targetBuilding = clickedB;
        GameState.selection.state = 'planting';
        return;
    }

    // Villager Auswahl
    let foundV = GameState.entities.villagers.find(v => Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 40);
    if (foundV) {
        GameState.selection = foundV;
        actionMenu.style.display = 'flex';
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none';
    }
}

// Event-Listener Registrierung
Renderer.canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

Renderer.canvas.addEventListener('touchstart', handleStart, {passive: false});
window.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd, {passive: false});

// Mobile-optimierte Button-Logik
function setupButton(btn, callback) {
    if (!btn) return;
    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        callback();
    };
    btn.addEventListener('touchstart', handler, {passive: false});
    btn.addEventListener('click', handler);
}

setupButton(btnWood, () => {
    if(GameState.selection) {
        GameState.selection.targetStone = null;
        GameState.selection.targetBuilding = null;
        GameState.selection.findNextTree(GameState);
    }
});

setupButton(btnStone, () => {
    if(GameState.selection) {
        GameState.selection.targetTree = null;
        GameState.selection.targetBuilding = null;
        GameState.selection.findNextStone(GameState);
    }
});

setupButton(btnStop, () => {
    if(GameState.selection) {
        GameState.selection.state = 'idle';
        GameState.selection.targetTree = null;
        GameState.selection.targetStone = null;
        GameState.selection.targetBuilding = null;
    }
});

setupButton(btnHouse, () => startPlacement('house', 50));
setupButton(btnLodge, () => startPlacement('lodge', 100));

function startPlacement(type, cost) {
    if (GameState.resources.wood >= cost) {
        GameState.placementMode = { active: true, type, cost, x: GameState.camera.x + Renderer.canvas.width/2, y: GameState.camera.y + Renderer.canvas.height/2 };
        placementControls.style.display = 'flex';
        actionMenu.style.display = 'none';
    }
}

setupButton(document.getElementById('btn-confirm-build'), () => {
    const p = GameState.placementMode;
    if (GameState.resources.wood >= p.cost) {
        GameState.resources.wood -= p.cost;
        const b = { x: p.x, y: p.y, type: p.type, progress: 0, isFinished: false };
        GameState.entities.buildings.push(b);
        if(GameState.selection) {
            GameState.selection.targetBuilding = b;
            GameState.selection.state = 'building';
            if (b.type === 'lodge') GameState.selection.autoBecomeForester = true;
        }
        cancelPlacement();
    }
});

setupButton(document.getElementById('btn-cancel-build'), cancelPlacement);

function cancelPlacement() {
    GameState.placementMode.active = false;
    placementControls.style.display = 'none';
    if(GameState.selection) actionMenu.style.display = 'flex';
}

function spawnVillager() {
    const now = Date.now();
    if (now - lastSpawnTime < 500) return;

    if (GameState.entities.villagers.length < GameState.getMaxPop()) {
        const tc = GameState.entities.townCenter;
        // Nutzt die importierte Klasse direkt
        const v = new Villager(tc.x + 50, tc.y + 50, now);
        GameState.entities.villagers.push(v);
        lastSpawnTime = now;
    }
}
