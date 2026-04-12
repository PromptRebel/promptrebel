// ui.js

const btnWood = document.getElementById('btn-wood');
const actionMenu = document.getElementById('action-menu');

// 1. Klick / Touch Erkennung
Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    console.log("Klick auf Position:", mx, my); // Debug-Info

    // A. Klick auf Dorfzentrum (HQ)?
    const tc = GameState.entities.townCenter;
    // Wir berechnen den Abstand vom Klick zum Zentrum des HQ
    const distToHQ = Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2);
    
    console.log("Abstand zum HQ:", distToHQ); // Debug-Info

    if (distToHQ < 60) { // Wir machen den Bereich richtig groß (60 Pixel Radius)
        console.log("HQ getroffen! Spawne Villager...");
        spawnVillager();
        return; 
    }

    // B. Klick auf Villager?
    let foundVillager = null;
    GameState.entities.villagers.forEach(v => {
        const dist = Math.sqrt((mx - v.x)**2 + (my - v.y)**2);
        if (dist < 40) { 
            foundVillager = v;
        }
    });

    if (foundVillager) {
        console.log("Villager ausgewählt:", foundVillager.id);
        GameState.selection = foundVillager;
        actionMenu.style.display = 'block'; 
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none'; 
    }
});

// 2. Button-Logik: Holz fällen
if(btnWood) {
    btnWood.addEventListener('click', (e) => {
        e.stopPropagation(); // Verhindert, dass der Klick durch den Button auf die Map geht
        if (GameState.selection) {
            const v = GameState.selection;
            
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
                v.state = VillagerState.IDLE; // Reset falls er gerade was anderes tut
                setTimeout(() => { v.state = VillagerState.MOVING_TO_TREE; }, 50);
                console.log("Befehl: Holz fällen!");
            }
        }
    });
}

function spawnVillager() {
    // Sicherstellen, dass das Limit nicht überschritten wird
    if (GameState.entities.villagers.length < GameState.config.maxVillagers) {
        const tc = GameState.entities.townCenter;
        // Wir nutzen den Konstruktor aus villager.js
        const v = new Villager(tc.x, tc.y + 60, Date.now());
        GameState.entities.villagers.push(v);
        console.log("Villager Liste aktuell:", GameState.entities.villagers.length);
    } else {
        console.warn("Limit erreicht!");
    }
}
