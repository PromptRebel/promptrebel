// ui.js

const btnWood = document.getElementById('btn-wood');
const actionMenu = document.getElementById('action-menu');

// 1. Klick / Touch Erkennung
Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // A. Klick auf Dorfzentrum (HQ)?
    const tc = GameState.entities.townCenter;
    if (Math.abs(mx - tc.x) < 40 && Math.abs(my - tc.y) < 40) {
        spawnVillager();
        return;
    }

    // B. Klick auf Villager? (Größerer Radius für Handy: 30 Pixel)
    let foundVillager = null;
    GameState.entities.villagers.forEach(v => {
        const dist = Math.sqrt((mx - v.x)**2 + (my - v.y)**2);
        if (dist < 30) { 
            foundVillager = v;
        }
    });

    if (foundVillager) {
        GameState.selection = foundVillager;
        actionMenu.style.display = 'block'; // Menü zeigen
    } else {
        // Wenn man ins Leere klickt, Auswahl aufheben
        GameState.selection = null;
        actionMenu.style.display = 'none'; // Menü verstecken
    }
});

// 2. Button-Logik: Holz fällen
btnWood.addEventListener('click', () => {
    if (GameState.selection) {
        const v = GameState.selection;
        
        // Nächsten Baum suchen
        let closestTree = null;
        let minDist = Infinity;

        GameState.entities.trees.forEach(t => {
            const d = Math.sqrt((t.x - v.x)**2 + (t.y - v.y)**2);
            if (d < minDist) {
                minDist = d;
                closestTree = t;
            }
        });

        if (closestTree) {
            v.targetTree = closestTree;
            v.state = VillagerState.MOVING_TO_TREE;
            console.log("Villager schickt sich an Holz zu fällen!");
        }
        
        // Menü nach Befehl optional wieder schließen oder offen lassen
        // actionMenu.style.display = 'none'; 
    }
});

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.config.maxVillagers) {
        const tc = GameState.entities.townCenter;
        // Spawnt den Villager leicht unterhalb des HQ
        const v = new Villager(tc.x, tc.y + 60, Date.now());
        GameState.entities.villagers.push(v);
        console.log("Neuer Dorfbewohner bereit!");
    } else {
        alert("Bevölkerungslimit erreicht!");
    }
}
