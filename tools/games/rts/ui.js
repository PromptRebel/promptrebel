// ui.js

// 1. Klick-Erkennung (Dein funktionierender Code)
Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // A. Klick auf Dorfzentrum?
    const tc = GameState.entities.townCenter;
    if (Math.abs(mx - tc.x) < 30 && Math.abs(my - tc.y) < 30) {
        spawnVillager();
        return;
    }

    // B. Klick auf Villager?
    let found = false;
    GameState.entities.villagers.forEach(v => {
        // Radius auf 30 erhöht, damit man ihn am Handy besser trifft
        if (Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 30) {
            GameState.selection = v;
            found = true;
        }
    });

    // Menü ein/ausblenden
    const menu = document.getElementById('action-menu');
    if (found) {
        GameState.selection = GameState.entities.villagers.find(v => v === GameState.selection);
        menu.style.display = 'block';
    } else {
        GameState.selection = null;
        menu.style.display = 'none';
    }
});

// 2. Die Button-Logik (Ersetzt die Taste "H")
document.getElementById('btn-wood').addEventListener('click', (e) => {
    // Verhindert, dass der Klick auf die Map durchgeht
    e.stopPropagation();

    if (GameState.selection) {
        const v = GameState.selection;
        
        // Nächsten Baum suchen (Dein funktionierender Code)
        let closestTree = GameState.entities.trees[0];
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
            // WICHTIG: Hier nutzen wir den String, falls VillagerState Probleme macht
            v.state = 'MOVING_TO_TREE'; 
            console.log("Job zugewiesen!");
        }
    }
});

// 3. Villager erstellen (Dein funktionierender Code)
function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.config.maxVillagers) {
        const tc = GameState.entities.townCenter;
        // Wir setzen ihn ein Stück weg, damit man das HQ noch anklicken kann
        const v = new Villager(tc.x + 50, tc.y + 50, Date.now());
        GameState.entities.villagers.push(v);
    }
}
